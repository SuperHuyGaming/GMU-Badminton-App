import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Paper,
  Box,
  Typography,
  Chip,
  Button,
  Avatar,
  AvatarGroup,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { toast } from 'react-hot-toast';
import apiFetch from '../utils/api';
import socket from '../utils/socket';
import { useAuth } from '../context/AuthContext';
import CourtCheckInModal from './CourtCheckInModal';
import MemberHoverCard from './MemberHoverCard';

export default function CourtOccupancyCard({ sx = {} }) {
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id;

  const [courts, setCourts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [selectedCourtNumber, setSelectedCourtNumber] = useState(1);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const fetchOccupancy = useCallback(async () => {
    try {
      const res = await apiFetch('/api/courts/recreational-occupancy');
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data.courts)) {
          setCourts(data.courts);
        }
      }
    } catch {
      // Fallback silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOccupancy();

    const handleOccupancyUpdate = (data) => {
      if (data?.courtNumber) {
        setCourts((prevCourts) =>
          prevCourts.map((c) =>
            c.courtNumber === data.courtNumber
              ? {
                  ...c,
                  recreationalOccupancy: {
                    ...c.recreationalOccupancy,
                    ...data.recreationalOccupancy,
                  },
                }
              : c
          )
        );
      } else {
        fetchOccupancy();
      }
    };

    socket.on('courtOccupancyUpdated', handleOccupancyUpdate);
    return () => {
      socket.off('courtOccupancyUpdated', handleOccupancyUpdate);
    };
  }, [fetchOccupancy]);

  // Find if current user is checked into any court
  const activeUserCourt = courts.find((court) =>
    court.recreationalOccupancy?.checkedInUsers?.some(
      (u) => String(u.userId) === String(currentUserId)
    )
  );

  const handleOpenCheckIn = (courtNum = 1) => {
    setSelectedCourtNumber(courtNum);
    setIsCheckInModalOpen(true);
  };

  const handleCheckOut = async (courtNum) => {
    setIsCheckingOut(true);
    try {
      const res = await apiFetch(`/api/courts/${courtNum}/check-out`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Check-out failed');
      }
      toast.success(data.message || `Checked out of RAC Court ${courtNum}`);
      fetchOccupancy();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      <Paper
        elevation={0}
        data-testid="court-occupancy-card"
        sx={{
          p: 2,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          ...sx,
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOnIcon color="primary" sx={{ fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight="bold">
              RAC Court Occupancy
            </Typography>
          </Box>
          <Chip
            label="Live RAC"
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
          />
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={22} />
          </Box>
        ) : (
          <Box>
            {/* Grid of Courts 1-6 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mb: 1.5 }}>
              {(courts.length > 0 ? courts : [1, 2, 3, 4, 5, 6].map(num => ({ courtNumber: num }))).map((court) => {
                const num = court.courtNumber;
                const checkedInUsers = court.recreationalOccupancy?.checkedInUsers || [];
                const isUserHere = checkedInUsers.some(
                  (u) => String(u.userId) === String(currentUserId)
                );
                const isOccupied = checkedInUsers.length > 0;

                return (
                  <Box key={num}>
                    <Box
                      onClick={() => !isUserHere && handleOpenCheckIn(num)}
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: isUserHere
                          ? 'success.main'
                          : isOccupied
                          ? 'primary.light'
                          : 'divider',
                        bgcolor: isUserHere
                          ? 'action.selected'
                          : 'background.default',
                        cursor: isUserHere ? 'default' : 'pointer',
                        transition: 'all 0.15s ease-in-out',
                        '&:hover': {
                          borderColor: 'primary.main',
                          transform: 'translateY(-1px)',
                        },
                      }}
                      data-testid={`court-grid-item-${num}`}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.75rem' }}>
                          Court {num}
                        </Typography>
                        {isUserHere ? (
                          <Chip
                            label="You"
                            size="small"
                            color="success"
                            sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }}
                          />
                        ) : (
                          <Chip
                            label={isOccupied ? `${checkedInUsers.length} In Play` : 'Open'}
                            size="small"
                            color={isOccupied ? 'primary' : 'default'}
                            variant="outlined"
                            sx={{ height: 16, fontSize: '0.6rem' }}
                          />
                        )}
                      </Box>

                      {/* Avatars of Checked In Users */}
                      {checkedInUsers.length > 0 ? (
                        <AvatarGroup
                          max={3}
                          sx={{
                            justifyContent: 'flex-start',
                            '& .MuiAvatar-root': { width: 22, height: 22, fontSize: '0.65rem' },
                          }}
                        >
                          {checkedInUsers.map((u, idx) => (
                            <Tooltip key={u.userId || idx} title={u.userName || 'Player'}>
                              <Box component="span">
                                <MemberHoverCard userId={u.userId || ''} user={u}>
                                  <Avatar src={u.avatarUrl} alt={u.userName}>
                                    {(u.userName || 'P').charAt(0)}
                                  </Avatar>
                                </MemberHoverCard>
                              </Box>
                            </Tooltip>
                          ))}
                        </AvatarGroup>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                          Tap to claim
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Check-In / Check-Out Controls */}
            {activeUserCourt ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                  <Typography variant="caption" fontWeight="bold">
                    At Court {activeUserCourt.courtNumber}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disabled={isCheckingOut}
                  startIcon={<ExitToAppIcon sx={{ fontSize: 16 }} />}
                  onClick={() => handleCheckOut(activeUserCourt.courtNumber)}
                  data-testid="checkout-btn"
                  sx={{
                    borderRadius: 2,
                    fontSize: '0.72rem',
                    textTransform: 'none',
                    py: 0.3,
                  }}
                >
                  {isCheckingOut ? 'Checking out...' : 'Check Out'}
                </Button>
              </Box>
            ) : (
              <Button
                variant="contained"
                fullWidth
                size="small"
                startIcon={<SportsTennisIcon sx={{ fontSize: 18 }} />}
                onClick={() => handleOpenCheckIn(1)}
                data-testid="open-check-in-btn"
                sx={{
                  borderRadius: 2,
                  fontWeight: 'bold',
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  py: 0.75,
                }}
              >
                Check In to RAC Courts
              </Button>
            )}
          </Box>
        )}
      </Paper>

      {/* Check In Modal */}
      <CourtCheckInModal
        open={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        selectedCourtNumber={selectedCourtNumber}
        courts={courts}
        onCheckInSuccess={() => {
          fetchOccupancy();
        }}
      />
    </>
  );
}

CourtOccupancyCard.propTypes = {
  sx: PropTypes.object,
};
