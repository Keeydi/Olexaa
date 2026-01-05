import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme';

const statusMap = {
  fresh: { label: 'Fresh', color: theme.colors.primary },
  expiring: { label: 'Expiring soon', color: theme.colors.accent },
  expired: { label: 'Expired', color: theme.colors.danger },
};

import { getCategoryName } from '../data/categories';

export function FoodItemCard({ item, onDelete, onEdit }) {
  const status = statusMap[item.status] ?? statusMap.fresh;

  return (
    <View style={styles.card}>
      <View style={styles.emojiBubble}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.subtitle}>
          {item.quantity} • Exp {item.expiry_date}
        </Text>
        {item.category && (
          <Text style={styles.categoryText}>
            {getCategoryName(item.category)}
          </Text>
        )}
        {item.value != null && (
          <Text style={styles.subtitle}>
            Value: {Number(item.value).toFixed(2)}
          </Text>
        )}
        <View style={[styles.statusPill, { backgroundColor: status.color }]}>
          <Text style={styles.statusText}>{status.label}</Text>
        </View>
      </View>
      <View style={styles.actionButtons}>
        {onEdit && (
          <TouchableOpacity
            onPress={() => onEdit(item)}
            style={styles.editButton}
            accessibilityLabel="Edit item"
          >
            <Feather name="edit-2" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            style={styles.deleteButton}
            accessibilityLabel="Delete item"
          >
            <Feather name="trash-2" size={18} color={theme.colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.cardRadius,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadow.card,
    position: 'relative',
  },
  emojiBubble: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  meta: {
    flex: 1,
  },
  title: {
    fontFamily: theme.typography.semibold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.typography.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  categoryText: {
    fontFamily: theme.typography.medium,
    fontSize: 12,
    color: theme.colors.accent,
    marginTop: 2,
  },
  statusPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: theme.typography.medium,
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  editButton: {
    padding: theme.spacing.xs,
  },
  deleteButton: {
    padding: theme.spacing.xs,
  },
});


