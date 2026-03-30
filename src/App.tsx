import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from './MapComponent';
import { AlertTriangle, MapPin, Send, Image as ImageIcon, Edit, Trash2, XCircle } from 'lucide-react';
import exifr from 'exifr';
import './index.css';

export interface TrackingPoint {
  id: string;
  lat: number;
  lng: number;
  timestamp: string;
  description: string;
  type: string;
  mediaUrl: string | null;
  mediaType: string | null;
}

const API_URL = '/api/points';

function App() {
  const [points, setPoints] = useState<TrackingPoint[]>([]);
  const [selectedLatLng, setSelectedLatLng] = useState<{lat: number, lng: number} | null>(null);
  
  // Form states
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [rawLocationInput, setRawLocationInput] = useState('');
  const [time, setTime] = useState(new Date().toISOString().substring(0, 16));
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPoints = async () => {
    try {
      const res = await axios.get(API_URL);
      setPoints(res.data);
    } catch (err) {
      console.error('Error fetching points', err);
    }
  };

  useEffect(() => {
    fetchPoints();
    // Real-time polling
    const interval = setInterval(fetchPoints, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLatLng) {
      alert('Vui lòng click vào bản đồ để chọn tọa độ');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('lat', selectedLatLng.lat.toString());
    formData.append('lng', selectedLatLng.lng.toString());
    formData.append('timestamp', new Date(time).toISOString());
    formData.append('description', description);
    
    if (mediaFile) {
      formData.append('media', mediaFile);
    }

    try {
      if (editingPointId) {
        // Update
        await axios.put(`${API_URL}/${editingPointId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Create
        formData.append('type', points.length === 0 ? 'stolen_location' : 'sighting');
        await axios.post(API_URL, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      resetForm();
      await fetchPoints();
    } catch (err) {
      alert('Lỗi khi lưu dữ liệu');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (point: TrackingPoint) => {
    setEditingPointId(point.id);
    setSelectedLatLng({ lat: point.lat, lng: point.lng });
    setDescription(point.description);
    // Format timestamp for datetime-local input (YYYY-MM-DDThh:mm)
    const dt = new Date(point.timestamp);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    setTime(dt.toISOString().slice(0, 16));
    setMediaFile(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa điểm này không?')) {
      try {
        await axios.delete(`${API_URL}/${id}`);
        if (editingPointId === id) resetForm();
        await fetchPoints();
      } catch (err) {
        alert('Lỗi xóa điểm');
      }
    }
  };

  const resetForm = () => {
    setDescription('');
    setMediaFile(null);
    setSelectedLatLng(null);
    setRawLocationInput('');
    setTime(new Date().toISOString().substring(0, 16));
    setEditingPointId(null);
  };

  const parseLocationInput = (text: string) => {
    setRawLocationInput(text);
    if (!text.trim()) return;

    // Tìm trong Link Google Maps dạng @lat,lng hoặc dán tay "lat, lng"
    let match = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!match) {
      match = text.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    }
    
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setSelectedLatLng({ lat, lng });
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    setMediaFile(file);
    if (!file) return;

    try {
      // Analyze EXIF data only if it is an image
      if (file.type.startsWith('image/')) {
        const metadata = await exifr.parse(file, { gps: true, tiff: true, exif: true });
        
        if (metadata) {
          let updated = false;
          // Check for GPS Location
          if (metadata.latitude && metadata.longitude) {
            setSelectedLatLng({ lat: metadata.latitude, lng: metadata.longitude });
            updated = true;
          }
          // Check for Creation Time (DateTimeOriginal or CreateDate)
          const exifDate = metadata.DateTimeOriginal || metadata.CreateDate || metadata.ModifyDate;
          if (exifDate instanceof Date) {
            // Convert to local time format 'YYYY-MM-DDTHH:mm'
            const dt = new Date(exifDate);
            dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
            setTime(dt.toISOString().slice(0, 16));
            updated = true;
          }

          if (updated) {
            alert('✅ Đã quét file thành công: Tự động trích xuất Tọa độ GPS và Thời gian chụp từ ảnh.');
          }
        }
      }
    } catch (err) {
      console.log('No EXIF data found or error parsing:', err);
    }
  };

  return (
    <div id="root">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1><AlertTriangle size={24} /> Báo Động Đỏ</h1>
        </div>
        <div className="alert-ribbon">
          Trạm Theo Dõi: QL6 Tân Lạc - Hòa Bình
        </div>
        
        <div className="form-container" style={{backgroundColor: editingPointId ? '#2b2311' : 'transparent'}}>
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #444', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            {editingPointId ? 'Cập nhật điểm' : 'Thêm điểm báo cáo'}
            {editingPointId && <button onClick={resetForm} className="btn-small" title="Hủy Cập Nhật"><XCircle size={14}/></button>}
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#ff4757', fontWeight: 'bold' }}>
            {selectedLatLng ? `Tọa độ: ${selectedLatLng.lat.toFixed(5)}, ${selectedLatLng.lng.toFixed(5)}` : '=> Click lên bản đồ để chọn tọa độ'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label>Tọa độ cắt dán / Link Google Maps</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Dán tọa độ (vd: 20.81, 105.33) hoặc link Map..."
                value={rawLocationInput}
                onChange={e => parseLocationInput(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Thời điểm phát hiện</label>
              <input 
                type="datetime-local" 
                className="form-control"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Đặc điểm nhận dạng / Mô tả</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="VD: Nam, áo đen..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label><ImageIcon size={14} style={{verticalAlign: 'middle'}}/> Ảnh gốc (Giúp trích xuất Tọa độ tự động)</label>
              <input 
                type="file" 
                className="form-control"
                accept="image/*,video/*"
                onChange={handleFileChange}
              />
            </div>

            <button type="submit" className="btn-submit" disabled={isSubmitting || !selectedLatLng} style={editingPointId ? {backgroundColor: '#e67e22'} : {}}>
              <Send size={16} style={{verticalAlign: 'middle', marginRight: '4px'}} />
              {isSubmitting ? 'Đang gửi...' : (editingPointId ? 'Lưu Cập Nhật' : 'Phát Tín Hiệu Báo Cáo')}
            </button>
          </form>
        </div>

        <div className="point-list">
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
            Nhật ký di chuyển
          </h3>
          {points.length === 0 && <p style={{color: '#888', fontSize: '0.85rem'}}>Chưa có dấu vết nào được ghi nhận.</p>}
          {points.map((p, idx) => (
            <div key={p.id} className="point-item" style={editingPointId === p.id ? {borderColor: '#e67e22'} : {}}>
              <div className="point-item-header">
                <strong><MapPin size={14} color={idx === 0 ? "#ff4757" : "#3498db"} /> Điểm thứ #{idx + 1}</strong>
                <span className="point-time">{new Date(p.timestamp).toLocaleTimeString('vi-VN')}</span>
              </div>
              <p className="point-desc">{p.description}</p>
              {p.mediaUrl && (
                <div style={{marginTop: '8px'}}>
                  {p.mediaType?.includes('video') ? (
                    <video src={p.mediaUrl ?? ''} controls className="popup-image" />
                  ) : (
                    <img src={p.mediaUrl ?? ''} alt="Sighting" className="popup-image" />
                  )}
                </div>
              )}
              
              <div className="point-actions">
                <button className="btn-small" onClick={() => handleEdit(p)}>
                  <Edit size={12}/> Sửa
                </button>
                <button className="btn-small btn-delete" onClick={() => handleDelete(p.id)}>
                  <Trash2 size={12}/> Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="map-container">
        <MapComponent 
          points={points} 
          selectedLatLng={selectedLatLng} 
          onMapClick={(lat, lng) => setSelectedLatLng({lat, lng})} 
        />
      </div>
    </div>
  );
}

export default App;
