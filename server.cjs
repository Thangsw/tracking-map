const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const https = require('https');

// ═══════════════════════════════════════════════════════════
// AI CONFIG (Gemini/Gemma Logic) - BẢO MẬT: Dùng biến môi trường
// ═══════════════════════════════════════════════════════════
const MODELS = [
  "gemini-1.5-flash",
  "gemini-2.0-flash",
];

// Đọc danh sách keys từ biến môi trường (cấu hình trên Railway)
const ALL_KEYS = process.env.GEMINI_KEYS ? process.env.GEMINI_KEYS.split(',') : [];

let keyIdx = 0;
const failedKeys = new Set();

function getNextKey() {
  if (ALL_KEYS.length === 0) return null;
  const available = ALL_KEYS.filter(k => !failedKeys.has(k));
  if (!available.length) {
    failedKeys.clear();
    return ALL_KEYS[0];
  }
  return available[keyIdx++ % available.length];
}

function callGemini(prompt) {
  return new Promise((resolve, reject) => {
    const model = MODELS[0];
    const key = getNextKey();
    if (!key) return reject(new Error("Chưa cấu hình GEMINI_KEYS trong biến môi trường!"));
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
    });

    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates[0].content.parts[0].text;
            resolve(text);
          } catch (e) { reject(e); }
        } else {
          if (res.statusCode === 429) failedKeys.add(key);
          reject(new Error(`AI Error: ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}


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

    fs.writeFileSync(dataFile, JSON.stringify(newPoints, null, 2));
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi xóa dữ liệu' });
  }
});

// AI Summarize Endpoint
app.post('/api/summarize', async (req, res) => {
  const { text, referenceTime } = req.body;
  if (!text) return res.status(400).json({ error: 'Thiếu text' });

  const prompt = `Bạn là trợ lý điều tra chuyên nghiệp. Hãy phân tích đoạn tin nhắn sau và trích xuất thông tin LỘ TRÌNH XE TRỘM CẮP.
Tin nhắn: "${text}"
Giờ gốc tham chiếu: ${referenceTime || new Date().toISOString()}

YÊU CẦU:
1. Tính toán thời gian chính xác (ví dụ: "15 phút sau" thì cộng vào giờ gốc).
2. Trích xuất đặc điểm/biển số xe.
3. Trả về kết quả CHỈ DUY NHẤT dưới dạng JSON như sau:
{
  "time": "YYYY-MM-DDTHH:mm:ss",
  "description": "Mô tả ngắn gọn đặc điểm xe và hành động",
  "notes": "Ghi chú chi tiết nếu có"
}

Nếu không tính được giờ, hãy giữ nguyên ngày của giờ gốc và chỉ thay đổi giờ:phút.`;

  try {
    const aiResponse = await callGemini(prompt);
    // Bóc tách JSON từ phản hồi của AI (phòng trường hợp AI bọc trong Markdown)
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      res.json(JSON.parse(jsonMatch[0]));
    } else {
      res.status(500).json({ error: 'AI không trả về đúng định dạng JSON' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi gọi AI' });
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
