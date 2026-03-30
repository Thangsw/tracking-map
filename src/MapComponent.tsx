import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TrackingPoint } from './App';

// Setup custom markers to bypass webpack icon issues in standard leaflet
const redIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const blueIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle clicks on the map to set a new point
function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Map automatically bounds to see all tracking points
function MapAutoBounder({ points }: { points: TrackingPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [points, map]);
  return null;
}

interface MapComponentProps {
  points: TrackingPoint[];
  selectedLatLng: {lat: number, lng: number} | null;
  onMapClick: (lat: number, lng: number) => void;
}

export default function MapComponent({ points, selectedLatLng, onMapClick }: MapComponentProps) {
  // Center is roughly at Hoa Binh / Tan Lac area
  const initCenter: [number, number] = [20.7335, 105.2933];

  const polylinePositions = points.map(p => [p.lat, p.lng] as [number, number]);

  return (
    <MapContainer 
      center={initCenter} 
      zoom={13} 
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      {/* Cool Dark theme map tiles */}
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      <ClickHandler onMapClick={onMapClick} />
      {points.length > 0 && <MapAutoBounder points={points} />}

      {/* Polyline connecting the chronological spots */}
      <Polyline positions={polylinePositions} color="#ff4757" weight={4} dashArray="5, 10" />

      {/* Markers for existing tracking points */}
      {points.map((p, index) => (
        <Marker 
          key={p.id} 
          position={[p.lat, p.lng]} 
          icon={index === 0 ? redIcon : blueIcon}
        >
          <Popup>
            <div style={{minWidth: '150px'}}>
              <h3 style={{margin: '0 0 5px 0', color: '#ff4757'}}>Điểm #{index + 1}</h3>
              <p style={{margin: '0 0 5px 0', fontSize: '12px', color: '#888'}}>
                {new Date(p.timestamp).toLocaleString('vi-VN')}
              </p>
              <p style={{margin: '0'}}>{p.description}</p>
              {p.mediaUrl && (
                p.mediaType?.includes('video') ? (
                  <video src={`http://localhost:3001${p.mediaUrl}`} controls className="popup-image" />
                ) : (
                  <img src={`http://localhost:3001${p.mediaUrl}`} alt="Bằng chứng" className="popup-image" />
                )
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Marker for current clicked location */}
      {selectedLatLng && (
        <Marker position={[selectedLatLng.lat, selectedLatLng.lng]} icon={redIcon}>
          <Popup>Vị trí đang chọn để báo cáo</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
