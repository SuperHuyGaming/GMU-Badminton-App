import React from 'react';

const MapPinIcon = ({ width = 24, height = 24, color = "#006633", className = "" }) => (
    <svg 
        width={width} 
        height={height} 
        viewBox="0 0 100 125" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))' }}
    >
        {/* Teardrop Pin Shape */}
        <path 
            d="M 50 120 Q 90 80 90 45 A 40 40 0 1 0 10 45 Q 10 80 50 120 Z" 
            fill={color} 
        />
        
        {/* Inner Circle Cutout */}
        <circle cx="50" cy="45" r="28" fill="#ffffff" />
        
        {/* GMU Badminton Shuttlecock Insignia */}
        <polygon points="38,36 62,36 56,54 44,54" fill={color}/>
        <path d="M 44,54 Q 50,65 56,54 Z" fill="#FFCC33"/>
        
        {/* Feathers */}
        <line x1="38" y1="36" x2="33" y2="22" stroke={color} strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="45" y1="36" x2="43" y2="18" stroke={color} strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="55" y1="36" x2="57" y2="18" stroke={color} strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="62" y1="36" x2="67" y2="22" stroke={color} strokeWidth="3.5" strokeLinecap="round"/>
        
        {/* Cross string */}
        <line x1="34" y1="26" x2="66" y2="26" stroke="#FFCC33" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
);

export default MapPinIcon;
