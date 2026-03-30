const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;

// Cấu hình lưu trữ Volume ngoài (Railway)
const DATA_DIR = process.env.DATA_DIR || __dirname;
const uploadDir = path.join(DATA_DIR, 'uploads');
const dataFile = path.join(DATA_DIR, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// Đảm bảo thư mục lưu trữ tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Hàm hỗ trợ đọc ghi
const readData = () => {
  if (!fs.existsSync(dataFile)) return [];
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
};

const writeData = (data) => {
  // Sắp xếp theo thời gian gốc trước khi lưu xuống Ổ cứng
  data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
};

/**
 * Trích xuất tọa độ (latitude, longitude) từ một URL của Google Maps.
 * @param {string} url - Đường link Google Maps.
 * @returns {{lat: number, lng: number}|null} - Object chứa lat/lng hoặc null nếu không tìm thấy.
 */
const extractCoordsFromUrl = (url) => {
  if (typeof url !== 'string') return null;

  // Regex tìm kiếm pattern @<latitude>,<longitude>
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

  if (match && match[1] && match[2]) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
    };
  }
  return null;
};


// Storage setup for Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Get all points
app.get('/api/points', (req, res) => {
  try {
    const points = readData();
    res.json(points);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đọc file dữ liệu' });
  }
});

// Add a new point
app.post('/api/points', upload.single('media'), (req, res) => {
  try {
    const points = readData(); // Đọc dữ liệu bằng hàm hỗ trợ

    let lat, lng;
    
    // Dữ liệu nhập vào có thể là URL (dán vào ô Vĩ độ) hoặc vĩ độ/kinh độ riêng
    const potentialUrl = req.body.lat; 
    const coords = extractCoordsFromUrl(potentialUrl);

    if (coords) {
      // Tìm thấy tọa độ từ URL
      lat = coords.lat;
      lng = coords.lng;
    } else {
      // Không phải URL hoặc không có tọa độ, coi như nhập tay
      lat = parseFloat(req.body.lat);
      lng = parseFloat(req.body.lng);
    }

    const newPoint = {
      id: Date.now().toString(),
      lat: lat,
      lng: lng,
      timestamp: req.body.timestamp || new Date().toISOString(),
      description: req.body.description || '',
      notes: req.body.notes || '',
      type: req.body.type || 'sighting',
      mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
      mediaType: req.file ? req.file.mimetype : null
    };

    // Kiểm tra lại tọa độ trước khi lưu
    if (isNaN(newPoint.lat) || isNaN(newPoint.lng)) {
        return res.status(400).json({ error: 'Tọa độ không hợp lệ. Vui lòng dùng link Google Maps có chứa "@" hoặc nhập vĩ độ/kinh độ thủ công.' });
    }

    points.push(newPoint);
    writeData(points); // Ghi dữ liệu bằng hàm hỗ trợ
    res.status(201).json({ message: 'Thêm điểm thành công', data: newPoint });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi ghi file dữ liệu' });
  }
});

// Update an existing point
app.put('/api/points/:id', upload.single('media'), (req, res) => {
  try {
    let points = readData();
    const pointIndex = points.findIndex(p => p.id === req.params.id);

    if (pointIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy điểm' });
    }

    const updatedPoint = {
      ...points[pointIndex],
      lat: req.body.lat ? parseFloat(req.body.lat) : points[pointIndex].lat,
      lng: req.body.lng ? parseFloat(req.body.lng) : points[pointIndex].lng,
      timestamp: req.body.timestamp || points[pointIndex].timestamp,
      description: req.body.description || points[pointIndex].description,
      notes: req.body.notes || points[pointIndex].notes || '',
    };

    if (req.file) {
      updatedPoint.mediaUrl = `/uploads/${req.file.filename}`;
      updatedPoint.mediaType = req.file.mimetype;
    }

    points[pointIndex] = updatedPoint;
    writeData(points);

    res.json({ message: 'Cập nhật thành công', data: updatedPoint });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi ghi file dữ liệu' });
  }
});

// Delete a point
app.delete('/api/points/:id', (req, res) => {
  try {
    let points = readData();
    const newPoints = points.filter(p => p.id !== req.params.id);

    writeData(newPoints);
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi xóa dữ liệu' });
  }
});

// Serve React production build
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Tracking Map Backend running on http://localhost:${PORT}`);
});
