import { useState, useEffect } from 'react';
import { Snackbar, Button, Alert } from '@mui/material';
import apiFetch from '../utils/api';

const urlB64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

const PushNotificationPrompt = () => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            if (Notification.permission === 'default') {
                // Wait a bit before asking so we don't bombard them immediately
                const timer = setTimeout(() => {
                    setOpen(true);
                }, 3000);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    const handleEnable = async () => {
        setOpen(false);
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const registration = await navigator.serviceWorker.ready;
                
                const applicationServerKey = urlB64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY);
                
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                });

                await apiFetch('/api/push/subscribe', {
                    method: 'POST',
                    body: JSON.stringify(subscription)
                });
                
                console.log("Subscribed to push notifications");
            }
        } catch (error) {
            console.error("Failed to subscribe to push notifications", error);
        }
    };

    return (
        <Snackbar 
            open={open} 
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            onClose={() => setOpen(false)}
        >
            <Alert 
                severity="info" 
                action={
                    <>
                        <Button color="inherit" size="small" onClick={handleEnable}>Enable</Button>
                        <Button color="inherit" size="small" onClick={() => setOpen(false)}>Not Now</Button>
                    </>
                }
            >
                Enable push notifications to get alerted for new messages!
            </Alert>
        </Snackbar>
    );
};

export default PushNotificationPrompt;
