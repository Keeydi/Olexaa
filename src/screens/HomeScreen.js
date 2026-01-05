import { useState, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme';
import { SectionHeader } from '../components/SectionHeader';
import { FoodItemCard } from '../components/FoodItemCard';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { foodCategories, getCategoryName } from '../data/categories';

export function HomeScreen({ items, user, onViewRecipes, onLogout, onDeleteItem, onEditItem }) {
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'fresh', 'expiring', 'expired'
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredItems = useMemo(() => {
    let filtered = items;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.category && getCategoryName(item.category).toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    return filtered;
  }, [items, searchQuery, statusFilter, categoryFilter]);

  const expiringSoon = items.filter((item) => item.status === 'expiring');
  const expired = items.filter((item) => item.status === 'expired');
  const fresh = items.filter((item) => item.status === 'fresh');

  const handleLogoutPress = () => {
    setLogoutModalVisible(true);
  };

  const handleLogoutConfirm = () => {
    setLogoutModalVisible(false);
    onLogout();
  };

  const handleDeleteItemPress = (itemId) => {
    setItemToDelete(itemId);
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirm = () => {
    if (itemToDelete && onDeleteItem) {
      onDeleteItem(itemToDelete);
    }
    setDeleteModalVisible(false);
    setItemToDelete(null);
  };

  const getUserDisplayName = () => {
    if (user?.name) {
      return user.name.charAt(0).toUpperCase() + user.name.slice(1);
    }
    return 'User';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerSection}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.header}>{getUserDisplayName()}</Text>
          <Text style={styles.subtitle}>Track your pantry efficiently</Text>
        </View>
        <TouchableOpacity onPress={handleLogoutPress} style={styles.logoutButton}>
          <Feather name="log-out" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity
          style={[styles.statCard, statusFilter === 'fresh' && styles.statCardActive]}
          onPress={() => setStatusFilter(statusFilter === 'fresh' ? 'all' : 'fresh')}
        >
          <Text style={styles.statValue}>{fresh.length}</Text>
          <Text style={styles.statLabel}>Fresh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, styles.statCardWarning, statusFilter === 'expiring' && styles.statCardActive]}
          onPress={() => setStatusFilter(statusFilter === 'expiring' ? 'all' : 'expiring')}
        >
          <Text style={[styles.statValue, styles.statValueWarning]}>{expiringSoon.length}</Text>
          <Text style={styles.statLabel}>Expiring</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, styles.statCardDanger, statusFilter === 'expired' && styles.statCardActive]}
          onPress={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
        >
          <Text style={[styles.statValue, styles.statValueDanger]}>{expired.length}</Text>
          <Text style={styles.statLabel}>Expired</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Feather name="x" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <TouchableOpacity
          style={[styles.filterChip, categoryFilter === 'all' && styles.filterChipActive]}
          onPress={() => setCategoryFilter('all')}
        >
          <Text style={[styles.filterText, categoryFilter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        {foodCategories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.filterChip, categoryFilter === cat.id && styles.filterChipActive]}
            onPress={() => setCategoryFilter(categoryFilter === cat.id ? 'all' : cat.id)}
          >
            <Text style={styles.filterEmoji}>{cat.emoji}</Text>
            <Text style={[styles.filterText, categoryFilter === cat.id && styles.filterTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <SectionHeader title="Your food items" actionLabel="Recipes" onPressAction={onViewRecipes} />
        {filteredItems.length > 0 ? (
        filteredItems.map((item) => (
          <FoodItemCard
            key={item.id}
            item={item}
            onDelete={handleDeleteItemPress}
            onEdit={onEditItem}
          />
        ))
        ) : (
        <View style={styles.emptyState}>
          <Feather name="package" size={48} color={theme.colors.muted} />
          <Text style={styles.emptyText}>
            {items.length === 0 ? 'No items yet' : 'No items match your filters'}
          </Text>
          <Text style={styles.emptySubtext}>
            {items.length === 0 ? 'Add your first item to get started' : 'Try adjusting your search or filters'}
          </Text>
        </View>
      )}

      <SectionHeader title="Expiring soon" />
      <View style={styles.expiringGrid}>
        {expiringSoon.length > 0 ? (
          expiringSoon.map((item) => (
            <TouchableOpacity key={item.id} style={styles.expiringCard}>
              <Text style={styles.expiringEmoji}>{item.emoji}</Text>
              <Text style={styles.expiringName}>{item.name}</Text>
              <Text style={styles.expiringDate}>Exp {item.expiry_date}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={[styles.expiringCard, styles.expiringEmpty]}>
            <Feather name="check-circle" size={24} color={theme.colors.primary} />
            <Text style={styles.expiringName}>All good for now!</Text>
          </View>
        )}
      </View>

      <ConfirmationModal
        visible={logoutModalVisible}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutModalVisible(false)}
        confirmText="Sign Out"
        type="info"
      />

      <ConfirmationModal
        visible={deleteModalVisible}
        title="Delete Item"
        message={`Are you sure you want to delete "${items.find((i) => i.id === itemToDelete)?.name}"?`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteModalVisible(false);
          setItemToDelete(null);
        }}
        confirmText="Delete"
        type="danger"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  greeting: {
    fontFamily: theme.typography.medium,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  header: {
    fontFamily: theme.typography.bold,
    fontSize: 32,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.typography.medium,
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  logoutButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    ...theme.shadow.card,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.cardRadius,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  statCardWarning: {
    backgroundColor: '#FFF4E6',
  },
  statCardDanger: {
    backgroundColor: '#FEE2E2',
  },
  statValue: {
    fontFamily: theme.typography.bold,
    fontSize: 24,
    color: theme.colors.primary,
  },
  statValueWarning: {
    color: theme.colors.accent,
  },
  statValueDanger: {
    color: theme.colors.danger,
  },
  statLabel: {
    fontFamily: theme.typography.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.cardRadius,
    ...theme.shadow.card,
  },
  emptyText: {
    fontFamily: theme.typography.semibold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontFamily: theme.typography.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  expiringGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  expiringCard: {
    width: '47%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.cardRadius,
    padding: theme.spacing.md,
    ...theme.shadow.card,
  },
  expiringEmoji: {
    fontSize: 26,
  },
  expiringName: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  expiringDate: {
    fontFamily: theme.typography.medium,
    color: theme.colors.danger,
    marginTop: 4,
    fontSize: 12,
  },
  expiringEmpty: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  searchSection: {
    marginBottom: theme.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.inputRadius,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    fontFamily: theme.typography.medium,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  clearButton: {
    padding: theme.spacing.xs,
  },
  filterScroll: {
    marginBottom: theme.spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.shapes.buttonRadius,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterEmoji: {
    fontSize: 14,
  },
  filterText: {
    fontFamily: theme.typography.medium,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  filterTextActive: {
    color: '#fff',
  },
  statCardActive: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
});


