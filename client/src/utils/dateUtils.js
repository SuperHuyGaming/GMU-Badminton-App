export const formatNotificationTime = (dateString) => {
    if (!dateString) return "";
    
    const date = new Date(dateString);
    const now = new Date();
    
    // Difference in hours
    const diffInMs = now - date;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
        // Less than 24 hours ago, just show time
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else {
        // More than 24 hours ago, show Date + Time
        return date.toLocaleDateString([], { month: "short", day: "numeric" }) + 
               " at " + 
               date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
};
