import React from "react";
import { Box, Skeleton, Card, CardContent, CardHeader } from "@mui/material";

export const PostSkeleton = () => (
	<Card sx={{ mb: 2, borderRadius: 3, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
		<CardHeader
			avatar={<Skeleton animation="wave" variant="circular" width={40} height={40} />}
			title={<Skeleton animation="wave" height={20} width="40%" sx={{ mb: 1 }} />}
			subheader={<Skeleton animation="wave" height={15} width="20%" />}
		/>
		<CardContent>
			<Skeleton animation="wave" height={24} width="80%" sx={{ mb: 2 }} />
			<Skeleton animation="wave" variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
		</CardContent>
	</Card>
);

export const LeaderboardRowSkeleton = () => (
	<Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
		<Skeleton animation="wave" variant="circular" width={24} height={24} sx={{ mr: 2 }} />
		<Skeleton animation="wave" variant="circular" width={40} height={40} sx={{ mr: 2 }} />
		<Box sx={{ flexGrow: 1 }}>
			<Skeleton animation="wave" height={20} width="40%" sx={{ mb: 0.5 }} />
			<Skeleton animation="wave" height={15} width="20%" />
		</Box>
		<Skeleton animation="wave" height={30} width={60} sx={{ borderRadius: 10 }} />
	</Box>
);

export const ProfileSkeleton = () => (
	<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 4 }}>
		<Skeleton animation="wave" variant="circular" width={120} height={120} sx={{ mb: 2 }} />
		<Skeleton animation="wave" height={40} width="60%" sx={{ mb: 1 }} />
		<Skeleton animation="wave" height={20} width="30%" sx={{ mb: 4 }} />
		
		<Box sx={{ width: '100%', display: 'flex', gap: 2, px: 2 }}>
			<Skeleton animation="wave" variant="rectangular" height={100} sx={{ flex: 1, borderRadius: '12px' }} />
			<Skeleton animation="wave" variant="rectangular" height={100} sx={{ flex: 1, borderRadius: '12px' }} />
		</Box>
	</Box>
);
