// client/src/components/ErrorBoundary.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import BugReportIcon from '@mui/icons-material/BugReport';
import HomeIcon from '@mui/icons-material/Home';
import { useFeedback } from '../context/FeedbackContext';

class ErrorBoundaryInner extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error('[ErrorBoundary] Caught render exception:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        if (typeof this.props.onReset === 'function') {
            this.props.onReset();
        }
    };

    handleReport = () => {
        const { feedback } = this.props;
        const { error, errorInfo } = this.state;
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        const errorMessage = error?.message || 'Unknown render error';
        const componentStack = errorInfo?.componentStack || '';

        if (feedback?.openFeedbackModal) {
            feedback.openFeedbackModal({
                type: 'bug',
                severity: 'critical',
                pageUrl: currentPath,
                initialData: {
                    type: 'bug',
                    severity: 'critical',
                    pageUrl: currentPath,
                    title: `Render Error: ${errorMessage.slice(0, 80)}`,
                    description: `Error: ${errorMessage}\n\nStack:\n${componentStack.slice(0, 500)}`,
                },
            });
        }
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '50vh',
                        p: { xs: 2, sm: 4 },
                    }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            p: { xs: 3, sm: 5 },
                            maxWidth: 560,
                            width: '100%',
                            textAlign: 'center',
                            borderRadius: 4,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                        }}
                    >
                        <Box
                            sx={{
                                width: 56,
                                height: 56,
                                borderRadius: '50%',
                                bgcolor: 'error.lighter',
                                color: 'error.main',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mx: 'auto',
                                mb: 2.5,
                            }}
                        >
                            <BugReportIcon sx={{ fontSize: 32 }} />
                        </Box>

                        <Typography
                            variant="h5"
                            fontWeight={800}
                            gutterBottom
                            sx={{ letterSpacing: '-0.3px', color: 'text.primary' }}
                        >
                            Something went wrong
                        </Typography>

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 3.5, lineHeight: 1.6 }}
                        >
                            An unexpected issue occurred while rendering this page. You can try refreshing
                            the view or report this issue directly to our team.
                        </Typography>

                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.5}
                            justifyContent="center"
                        >
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<RestartAltIcon />}
                                onClick={this.handleReset}
                                sx={{
                                    borderRadius: 2.5,
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    px: 2.5,
                                }}
                            >
                                Try again
                            </Button>

                            <Button
                                variant="outlined"
                                color="inherit"
                                startIcon={<BugReportIcon />}
                                onClick={this.handleReport}
                                sx={{
                                    borderRadius: 2.5,
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    px: 2,
                                    borderColor: 'divider',
                                }}
                            >
                                Report issue
                            </Button>

                            <Button
                                variant="text"
                                color="inherit"
                                startIcon={<HomeIcon />}
                                href="/"
                                sx={{
                                    borderRadius: 2.5,
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    px: 1.5,
                                }}
                            >
                                Return Home
                            </Button>
                        </Stack>
                    </Paper>
                </Box>
            );
        }

        return this.props.children;
    }
}

ErrorBoundaryInner.propTypes = {
    children: PropTypes.node,
    fallback: PropTypes.node,
    onReset: PropTypes.func,
    feedback: PropTypes.object,
};

export default function ErrorBoundary({ children, fallback, onReset }) {
    const feedback = useFeedback();
    return (
        <ErrorBoundaryInner feedback={feedback} fallback={fallback} onReset={onReset}>
            {children}
        </ErrorBoundaryInner>
    );
}

ErrorBoundary.propTypes = {
    children: PropTypes.node,
    fallback: PropTypes.node,
    onReset: PropTypes.func,
};
