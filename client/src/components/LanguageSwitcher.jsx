import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, MenuItem, IconButton, Typography } from '@mui/material';

const GlobeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
);

const languages = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'vi', label: 'Tiếng Việt', short: 'VI' },
    { code: 'zh', label: '中文', short: 'ZH' },
    { code: 'ko', label: '한국어', short: 'KO' }
];

export default function LanguageSwitcher() {
    // Hidden for this release as i18n is not fully implemented
    return null;
}
