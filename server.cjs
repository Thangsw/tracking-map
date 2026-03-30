const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Storage setup for Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });
const dataFile = path.join(__dirname, 'data.json');

// Get all points
app.get('/api/points', (req, res) => {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đọc file dữ liệu' });
  }
});

// Add a new point
app.post('/api/points', upload.single('media'), (req, res) => {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    const points = JSON.parse(data);

    const newPoint = {
      id: Date.now().toString(),
      lat: parseFloat(req.body.lat),
      lng: parseFloat(req.body.lng),
      timestamp: req.body.timestamp || new Date().toISOString(),
      description: req.body.description || '',
      type: req.body.type || 'sighting',
      mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
      mediaType: req.file ? req.file.mimetype : null
    };

    points.push(newPoint);
    
    // Sort chronologically
    points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    fs.writeFileSync(dataFile, JSON.stringify(points, null, 2));
    res.json({ message: 'Thêm điểm thành công', data: newPoint });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi ghi file dữ liệu' });
  }
});

// Update an existing point
app.put('/api/points/:id', upload.single('media'), (req, res) => {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    let points = JSON.parse(data);
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
    };

    if (req.file) {
      updatedPoint.mediaUrl = `/uploads/${req.file.filename}`;
      updatedPoint.mediaType = req.file.mimetype;
    }

    points[pointIndex] = updatedPoint;
    points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    fs.writeFileSync(dataFile, JSON.stringify(points, null, 2));
    res.json({ message: 'Cập nhật thành công', data: updatedPoint });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi ghi file dữ liệu' });
  }
});

// Delete a point
app.delete('/api/points/:id', (req, res) => {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    let points = JSON.parse(data);
    const newPoints = points.filter(p => p.id !== req.params.id);

    fs.writeFileSync(dataFile, JSON.stringify(newPoints, null, 2));
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
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Tracking Map Backend running on http://localhost:${PORT}`);
});
