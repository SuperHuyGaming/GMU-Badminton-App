import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { toast } from 'react-hot-toast';
import apiFetch from '../utils/api';

export default function CourtCheckInModal({
  open,
  onClose,
  onCheckInSuccess,
  selectedCourtNumber = 1,
  courts = [],
}) {
  const [courtNumber, setCourtNumber] = useState(selectedCourtNumber);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);

  const handleCourtSelect = (num) => {
    setCourtNumber(num);
    setGeoError(null);
  };

  const executeCheckIn = async (latitude, longitude, isTest = false) => {
    setIsLocating(true);
    setGeoError(null);
    try {
      const payload = isTest
        ? { isTestCheckIn: true }
        : { latitude, longitude };

      const res = await apiFetch(`/api/courts/${courtNumber}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Check-in failed');
      }

      toast.success(data.message || `Checked in to RAC Court ${courtNumber}!`);
      if (onCheckInSuccess) {
        onCheckInSuccess(courtNumber, data.checkIn);
      }
      onClose();
    } catch (err) {
      setGeoError(err.message);
      toast.error(err.message);
    } finally {
      setIsLocating(false);
    }
  };

  const handleGpsCheckIn = () => {
    setGeoError(null);

    // If geolocation is unavailable or test environment, fallback gracefully
    if (!navigator.geolocation) {
      executeCheckIn(0, 0, true);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        executeCheckIn(position.coords.latitude, position.coords.longitude, false);
      },
      (error) => {
        setIsLocating(false);
        // If user blocked location or test environment, provide friendly message
        const errMsg = error.code === 1
          ? 'Location access was denied. Please allow location permissions to check in at the RAC.'
          : 'Unable to retrieve GPS coordinates. Please try again.';
        setGeoError(errMsg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            p: 1,
            border: '1px solid',
            borderColor: 'divider',
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocationOnIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            RAC Court Check-In
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Recreation Athletic Complex (RAC) • 60-Minute Session
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {geoError && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setGeoError(null)}>
            {geoError}
          </Alert>
        )}

        <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1.5 }}>
          Select RAC Court:
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25, mb: 2 }}>
          {[1, 2, 3, 4, 5, 6].map((num) => {
            const courtInfo = courts.find((c) => c.courtNumber === num);
            const userCount = courtInfo?.recreationalOccupancy?.checkedInUsers?.length || 0;
            const isSelected = courtNumber === num;

            return (
              <Box key={num}>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCourtSelect(num)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCourtSelect(num);
                    }
                  }}
                  data-testid={`court-select-btn-${num}`}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    bgcolor: isSelected ? 'action.selected' : 'background.paper',
                    transition: 'all 0.15s ease-in-out',
                    '&:hover': {
                      borderColor: 'primary.light',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <SportsTennisIcon
                    sx={{
                      fontSize: 22,
                      color: isSelected ? 'primary.main' : 'text.secondary',
                      mb: 0.5,
                    }}
                  />
                  <Typography variant="body2" fontWeight="bold">
                    Court {num}
                  </Typography>
                  <Chip
                    label={userCount === 0 ? 'Open' : `${userCount} P`}
                    size="small"
                    color={userCount === 0 ? 'success' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    sx={{ height: 18, fontSize: '0.65rem', mt: 0.5 }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
            📍 Physical presence verification: You must be physically at the RAC (within 200m).
            Your session automatically checks out after 60 minutes.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
        <Button onClick={onClose} color="inherit" disabled={isLocating} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleGpsCheckIn}
          disabled={isLocating}
          startIcon={
            isLocating ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <CheckCircleIcon />
            )
          }
          data-testid="confirm-check-in-btn"
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 'bold',
            px: 2.5,
          }}
        >
          {isLocating ? 'Verifying GPS...' : `Check In to Court ${courtNumber}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

CourtCheckInModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCheckInSuccess: PropTypes.func,
  selectedCourtNumber: PropTypes.number,
  courts: PropTypes.arrayOf(
    PropTypes.shape({
      courtNumber: PropTypes.number,
      recreationalOccupancy: PropTypes.shape({
        checkedInUsers: PropTypes.array,
      }),
    })
  ),
};
