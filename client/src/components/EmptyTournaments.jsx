import PropTypes from 'prop-types';
import EmptyState from './EmptyState';

export default function EmptyTournaments({ onResetFilters, onSubmitDiscovery }) {
    return (
        <EmptyState
            type="no-tournaments"
            title="No approved tournaments currently scheduled. Check back soon or submit a tournament discovery!"
            description="Tournaments across collegiate clubs, regional academies, and open circuits in DC, Maryland, and Virginia will appear here as schedules are verified."
            actionLabel={onResetFilters ? "Reset Search Filters" : undefined}
            onAction={onResetFilters}
            secondaryActionLabel={onSubmitDiscovery ? "Submit Tournament Discovery" : undefined}
            onSecondaryAction={onSubmitDiscovery}
            sx={{ mt: 2 }}
        />
    );
}

EmptyTournaments.propTypes = {
    onResetFilters: PropTypes.func,
    onSubmitDiscovery: PropTypes.func
};
