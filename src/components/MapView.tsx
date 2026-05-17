'use client';

import { useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { HousingListing } from '@/types';
import { formatPrice, formatLayout, formatSize } from '@/utils/formatters';

// 自訂價格範圍顏色圖標
function createPriceMarker(price: number, unit: string, isSponsored: boolean): L.DivIcon {
  const priceLabel = unit === '元/月'
    ? `${Math.round(price / 10000)}萬`
    : `${price >= 10000 ? (price / 10000).toFixed(1) + '億' : price + '萬'}`;
  const bgColor = isSponsored ? '#ef4444' : '#3b82f6';
  const borderColor = isSponsored ? '#dc2626' : '#2563eb';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: ${bgColor};
        color: white;
        padding: 2px 8px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        border: 2px solid ${borderColor};
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        cursor: pointer;
        transition: transform 0.15s;
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
      ">${priceLabel}</div>
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid ${borderColor};
        margin: 0 auto;
      "></div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -28],
  });
}

interface MapViewProps {
  listings: HousingListing[];
  selectedId?: string | null;
  onSelectListing?: (id: string) => void;
  className?: string;
}

/** 地圖自動適配所有標記 — 當新座標加入時會自動重新適配 */
function FitBounds({ listings }: { listings: HousingListing[] }) {
  const map = useMap();
  const prevCount = useRef(0);

  useEffect(() => {
    const validMarkers = listings.filter(l => l.lat && l.lng);
    if (validMarkers.length === 0) return;

    const bounds = L.latLngBounds(
      validMarkers.map(l => [l.lat!, l.lng!] as [number, number])
    );

    if (bounds.isValid() && validMarkers.length !== prevCount.current) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      prevCount.current = validMarkers.length;
    }
  }, [listings, map]);

  return null;
}

/**
 * 地圖顯示組件
 * 在 OpenStreetMap 上標示所有搜尋到的房源位置
 */
export function MapView({ listings, selectedId, onSelectListing, className = '' }: MapViewProps) {
  // 過濾有座標的房源
  const validListings = useMemo(
    () => listings.filter(l => l.lat && l.lng),
    [listings]
  );

  // 計算地圖中心（如果有房源則取平均，否則顯示台北市）
  const center = useMemo(() => {
    if (validListings.length > 0) {
      const avgLat = validListings.reduce((s, l) => s + l.lat!, 0) / validListings.length;
      const avgLng = validListings.reduce((s, l) => s + l.lng!, 0) / validListings.length;
      return [avgLat, avgLng] as [number, number];
    }
    return [25.0375, 121.5637] as [number, number]; // 台北市中心
  }, [validListings]);

  // 根據房源數量動態決定縮放級別
  const zoom = validListings.length > 0 ? 13 : 12;

  const handleMarkerClick = useCallback((id: string) => {
    onSelectListing?.(id);
  }, [onSelectListing]);

  return (
    <div className={`rounded-2xl overflow-hidden border border-gray-200 shadow-sm ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full min-h-[400px] z-0"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds listings={validListings} />

        {validListings.map((listing) => {
          const markerIcon = createPriceMarker(listing.price, listing.priceUnit, listing.isSponsored);
          const isSelected = selectedId === listing.id;

          return (
            <Marker
              key={listing.id}
              position={[listing.lat!, listing.lng!]}
              icon={isSelected
                ? L.divIcon({
                    className: 'custom-marker',
                    html: `
                      <div style="
                        background: #f59e0b;
                        color: white;
                        padding: 3px 10px;
                        border-radius: 8px;
                        font-size: 12px;
                        font-weight: 700;
                        white-space: nowrap;
                        border: 2px solid #d97706;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        cursor: pointer;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                        transform: scale(1.1);
                      ">${listing.price.toLocaleString()} ${listing.priceUnit}</div>
                      <div style="
                        width: 0;
                        height: 0;
                        border-left: 6px solid transparent;
                        border-right: 6px solid transparent;
                        border-top: 6px solid #d97706;
                        margin: 0 auto;
                      "></div>
                    `,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0],
                    popupAnchor: [0, -30],
                  })
                : markerIcon
              }
              eventHandlers={{
                click: () => handleMarkerClick(listing.id),
              }}
            >
              <Popup>
                <ListingPopup listing={listing} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

/** 彈出視窗內容 */
function ListingPopup({ listing }: { listing: HousingListing }) {
  return (
    <div className="min-w-[220px] max-w-[260px]">
      {/* 圖片 */}
      {listing.imageUrl && (
        <div className="-mx-3 -mt-3 mb-2">
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-28 object-cover rounded-t-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* 標題 */}
      <h3 className="text-sm font-semibold text-gray-900 mb-1.5 line-clamp-2 leading-snug">
        {listing.title}
      </h3>

      {/* 位置 */}
      <p className="text-xs text-gray-500 mb-2 flex items-start gap-1">
        <span>📍</span>
        <span className="line-clamp-1">{listing.location}</span>
      </p>

      {/* 價格 */}
      <div className="text-base font-bold text-blue-600 mb-1.5">
        {formatPrice(listing.price, listing.priceUnit)}
      </div>

      {/* 詳細資訊 */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
          {formatLayout(listing.rooms, listing.livingRooms, listing.bathrooms)}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
          {formatSize(listing.size)}
        </span>
        {listing.floor && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
            {listing.floor}樓
          </span>
        )}
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
          {listing.platform}
        </span>
      </div>

      {/* 查看連結 */}
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg py-1.5 transition-colors"
      >
        查看詳細資訊 →
      </a>
    </div>
  );
}
