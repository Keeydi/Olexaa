import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Toast } from '../components/Toast';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme';
import { foodCategories } from '../data/categories';

const emojiOptions = ['🥬', '🍎', '🥕', '🥛', '🍞', '🧀', '🥚', '🍌', '🍅', '🥑'];

export function EditItemScreen({ item, onUpdate, onCancel }) {
  const [name, setName] = useState(item?.name || '');
  const [quantity, setQuantity] = useState(item?.quantity || '');
  const [expiryDate, setExpiryDate] = useState(item?.expiry_date || '');
  const [selectedEmoji, setSelectedEmoji] = useState(item?.emoji || '🥬');
  const [value, setValue] = useState(item?.value ? String(item.value) : '');
  const [category, setCategory] = useState(item?.category || '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setQuantity(item.quantity || '');
      setExpiryDate(item.expiry_date || '');
      setSelectedEmoji(item.emoji || '🥬');
      setValue(item.value ? String(item.value) : '');
      setCategory(item.category || '');
    }
  }, [item]);

  const parseExpiryDate = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    let parsed = new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
      const parts = trimmed.split(/[\/\-]/);
      if (parts.length === 3) {
        const [d, m, y] = parts.map((p) => parseInt(p, 10));
        if (!Number.isNaN(d) && !Number.isNaN(m) && !Number.isNaN(y)) {
          parsed = new Date(y, m - 1, d);
        }
      }
    }

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    parsed.setHours(0, 0, 0, 0);
    return parsed;
  };

  const validateForm = () => {
    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = 'Item name is required';
    }
    if (!quantity.trim()) {
      newErrors.quantity = 'Quantity is required';
    }
    if (!expiryDate.trim()) {
      newErrors.expiryDate = 'Expiry date is required';
    } else {
      const parsed = parseExpiryDate(expiryDate);
      if (!parsed) {
        newErrors.expiryDate = 'Enter a valid date (e.g. 30/11/2025)';
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (parsed < today) {
          newErrors.expiryDate = 'Expiry date cannot be in the past';
        }
      }
    }
    if (value.trim()) {
      const numeric = Number(value.trim());
      if (Number.isNaN(numeric) || numeric < 0) {
        newErrors.value = 'Enter a valid non-negative number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = () => {
    if (!validateForm()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fill in all required fields',
      });
      return;
    }

    setLoading(true);
    
    const numericValue = value.trim() ? Number(value.trim()) : undefined;

    onUpdate({
      name: name.trim(),
      quantity: quantity.trim(),
      expiry_date: expiryDate.trim(),
      emoji: selectedEmoji,
      value: numericValue,
      category: category || null,
    });
    
    setLoading(false);
  };

  if (!item) {
    return null;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={styles.header}>Edit Item</Text>
        {onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Feather name="x" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Select Emoji <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.emojiGrid}>
          {emojiOptions.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.emojiOption,
                selectedEmoji === emoji && styles.emojiOptionSelected,
              ]}
              onPress={() => setSelectedEmoji(emoji)}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Category
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {foodCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                category === cat.id && styles.categoryChipSelected,
              ]}
              onPress={() => setCategory(cat.id)}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text style={[
                styles.categoryText,
                category === cat.id && styles.categoryTextSelected,
              ]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Estimated Value (optional)
        </Text>
        <TextInput
          placeholder="e.g. 4.50"
          keyboardType="decimal-pad"
          style={[styles.input, errors.value && styles.inputError]}
          value={value}
          onChangeText={(text) => {
            setValue(text);
            if (errors.value) setErrors({ ...errors, value: null });
          }}
        />
        {errors.value && (
          <Text style={styles.errorText}>{errors.value}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          placeholder="e.g. Spinach"
          style={[styles.input, errors.name && styles.inputError]}
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errors.name) setErrors({ ...errors, name: null });
          }}
        />
        {errors.name && (
          <Text style={styles.errorText}>{errors.name}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Quantity <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          placeholder="e.g. 1 bag, 500g, 2 pieces"
          style={[styles.input, errors.quantity && styles.inputError]}
          value={quantity}
          onChangeText={(text) => {
            setQuantity(text);
            if (errors.quantity) setErrors({ ...errors, quantity: null });
          }}
        />
        {errors.quantity && (
          <Text style={styles.errorText}>{errors.quantity}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Expiry Date <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          placeholder="e.g. Nov 30, 2025 or 30/11/2025"
          style={[styles.input, errors.expiryDate && styles.inputError]}
          value={expiryDate}
          onChangeText={(text) => {
            setExpiryDate(text);
            if (errors.expiryDate) setErrors({ ...errors, expiryDate: null });
          }}
        />
        {errors.expiryDate && (
          <Text style={styles.errorText}>{errors.expiryDate}</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleUpdate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Update Item</Text>
        )}
      </TouchableOpacity>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  header: {
    fontFamily: theme.typography.bold,
    fontSize: 28,
    color: theme.colors.textPrimary,
  },
  cancelButton: {
    padding: theme.spacing.xs,
  },
  formGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontSize: 14,
  },
  required: {
    color: theme.colors.danger,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  emojiOption: {
    width: 50,
    height: 50,
    borderRadius: theme.shapes.inputRadius,
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
  },
  emojiText: {
    fontSize: 24,
  },
  categoryScroll: {
    marginTop: theme.spacing.xs,
  },
  categoryChip: {
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
  categoryChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryText: {
    fontFamily: theme.typography.medium,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  categoryTextSelected: {
    color: '#fff',
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.inputRadius,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontFamily: theme.typography.medium,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    fontFamily: theme.typography.medium,
    fontSize: 12,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
  },
  button: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md + 4,
    borderRadius: theme.shapes.buttonRadius,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: theme.typography.semibold,
    fontSize: 16,
    color: '#fff',
  },
});


