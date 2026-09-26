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
    { code: 'vi', label: 'Ti?ng Vi?t', short: 'VI' },
    { code: 'zh', label: '??', short: 'ZH' },
    { code: 'ko', label: '???', short: 'KO' }
];

export default function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [anchorEl, setAnchorEl] = useState(null);

    const handleOpen = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleLanguageChange = (code) => {
        i18n.changeLanguage(code);
        handleClose();
    };

    const currentLang = languages.find(l => l.code === (i18n.language || 'en').split('-')[0]) || languages[0];

    return (
        <>
            <IconButton color="inherit" onClick={handleOpen} sx={{ display: 'flex', gap: 0.5 }}>
                <GlobeIcon />
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                    {currentLang.short}
                </Typography>
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        mt: 1,
                        borderRadius: 3,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                        minWidth: 150
                    }
                }}
            >
                {languages.map((lang) => (
                    <MenuItem 
                        key={lang.code} 
                        onClick={() => handleLanguageChange(lang.code)}
                        selected={currentLang.code === lang.code}
                        sx={{ fontWeight: currentLang.code === lang.code ? 'bold' : 'normal' }}
                    >
                        {lang.label}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
