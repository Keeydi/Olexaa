import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Toast } from '../components/Toast';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme';
import { analyzeFreshness, recognizeFoodItem } from '../services/aiService';
import { foodTemplates } from '../data/foodTemplates';
import { foodCategories } from '../data/categories';

const emojiOptions = ['🥬', '🍎', '🥕', '🥛', '🍞', '🧀', '🥚', '🍌', '🍅', '🥑'];

export function AddItemScreen({ onAddItem, onCancel }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🥬');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [imageUri, setImageUri] = useState(null);
  const [freshnessData, setFreshnessData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const parseExpiryDate = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Try native Date parsing first (works for things like "Nov 30, 2025")
    let parsed = new Date(trimmed);

    // If that fails, try DD/MM/YYYY
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

    // Normalise to start of day for comparison
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
    // Basic check: if a value is provided, it must be a valid number
    if (value.trim()) {
      const numeric = Number(value.trim());
      if (Number.isNaN(numeric) || numeric < 0) {
        newErrors.value = 'Enter a valid non-negative number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Camera Permission',
          text2: 'Camera access is required to take photos.',
        });
        return false;
      }
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        // Expo SDK update: use lower-case string enum values for mediaTypes
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setFreshnessData(null);
        setName(''); // Clear name to allow AI to fill it
        await recognizeAndAnalyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Toast.show({
        type: 'error',
        text1: 'Image Error',
        text2: 'Failed to pick image. Please try again.',
      });
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setFreshnessData(null);
        setName(''); // Clear name to allow AI to fill it
        await recognizeAndAnalyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Toast.show({
        type: 'error',
        text1: 'Camera Error',
        text2: 'Failed to take photo. Please try again.',
      });
    }
  };

  const recognizeAndAnalyzeImage = async (uri) => {
    setRecognizing(true);
    setAnalyzing(true);
    
    try {
      // First, recognize the food item (replaces barcode scanning)
      try {
        const recognition = await recognizeFoodItem(uri);
        if (recognition.name && recognition.name !== 'Food Item') {
          setName(recognition.name);
          // Find matching emoji from templates
          const template = foodTemplates.find(t => 
            t.name.toLowerCase() === recognition.name.toLowerCase()
          );
          if (template) {
            setSelectedEmoji(template.emoji);
            // Set suggested expiry date based on template
            if (recognition.estimated_expiry_days && !expiryDate) {
              const suggestedDate = new Date();
              suggestedDate.setDate(suggestedDate.getDate() + recognition.estimated_expiry_days);
              setExpiryDate(suggestedDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }));
            }
          }
          Toast.show({
            type: 'success',
            text1: 'Item Recognized',
            text2: `Detected: ${recognition.name}`,
          });
        }
      } catch (recognitionError) {
        console.error('Recognition error:', recognitionError);
        // Continue with freshness analysis even if recognition fails
      }
      
      setRecognizing(false);
      
      // Then analyze freshness
      const result = await analyzeFreshness(uri);
      setFreshnessData(result);

      // Suggest expiry date based on freshness
      if (result.freshness_score >= 75) {
        // Very fresh - suggest 7-10 days
        const suggestedDate = new Date();
        suggestedDate.setDate(suggestedDate.getDate() + 7);
        const formatted = suggestedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        if (!expiryDate) {
          setExpiryDate(formatted);
        }
      } else if (result.freshness_score >= 50) {
        // Fresh - suggest 3-5 days
        const suggestedDate = new Date();
        suggestedDate.setDate(suggestedDate.getDate() + 3);
        const formatted = suggestedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        if (!expiryDate) {
          setExpiryDate(formatted);
        }
      } else if (result.freshness_score >= 25) {
        // Expiring soon - suggest 1-2 days
        const suggestedDate = new Date();
        suggestedDate.setDate(suggestedDate.getDate() + 1);
        const formatted = suggestedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        if (!expiryDate) {
          setExpiryDate(formatted);
        }
      }

      // Suggest expiry date based on freshness
      if (result.freshness_score >= 75) {
        // Very fresh - suggest 7-10 days
        const suggestedDate = new Date();
        suggestedDate.setDate(suggestedDate.getDate() + 7);
        const formatted = suggestedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        if (!expiryDate) {
          setExpiryDate(formatted);
        }
      } else if (result.freshness_score >= 50) {
        // Fresh - suggest 3-5 days
        const suggestedDate = new Date();
        suggestedDate.setDate(suggestedDate.getDate() + 3);
        const formatted = suggestedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        if (!expiryDate) {
          setExpiryDate(formatted);
        }
      } else if (result.freshness_score >= 25) {
        // Expiring soon - suggest 1-2 days
        const suggestedDate = new Date();
        suggestedDate.setDate(suggestedDate.getDate() + 1);
        const formatted = suggestedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        if (!expiryDate) {
          setExpiryDate(formatted);
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Analysis Complete',
        text2: `Freshness: ${result.freshness_label}`,
      });
    } catch (error) {
      console.error('Error analyzing image:', error);
      Toast.show({
        type: 'error',
        text1: 'Analysis Failed',
        text2: error?.message || 'Could not analyze image.',
      });
    } finally {
      setAnalyzing(false);
      setRecognizing(false);
    }
  };

  const useTemplate = (template) => {
    setName(template.name);
    setSelectedEmoji(template.emoji);
    const suggestedDate = new Date();
    suggestedDate.setDate(suggestedDate.getDate() + template.defaultExpiryDays);
    setExpiryDate(suggestedDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }));
    setShowTemplates(false);
    Toast.show({
      type: 'info',
      text1: 'Template Applied',
      text2: `${template.name} template loaded`,
    });
  };

  const handleSave = () => {
    if (!validateForm()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fill in all required fields',
      });
      return;
    }

    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const numericValue = value.trim() ? Number(value.trim()) : undefined;

      onAddItem({
        name: name.trim(),
        quantity: quantity.trim(),
        expiry_date: expiryDate.trim(),
        emoji: selectedEmoji,
        value: numericValue,
        category: category || null,
      });
      setLoading(false);
      // Reset form
      setName('');
      setQuantity('');
      setExpiryDate('');
      setSelectedEmoji('🥬');
      setValue('');
    }, 500);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={styles.header}>Add Item</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => setShowTemplates(!showTemplates)}
            style={styles.templateButton}
          >
            <Feather name="zap" size={20} color={theme.colors.primary} />
            <Text style={styles.templateButtonText}>Quick Add</Text>
          </TouchableOpacity>
          {onCancel && (
            <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
              <Feather name="x" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showTemplates && (
        <View style={styles.templatesContainer}>
          <Text style={styles.templatesTitle}>Quick Add Templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {foodTemplates.map((template) => (
              <TouchableOpacity
                key={template.name}
                style={styles.templateCard}
                onPress={() => useTemplate(template)}
              >
                <Text style={styles.templateEmoji}>{template.emoji}</Text>
                <Text style={styles.templateName}>{template.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.cameraSection}>
        {imageUri ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => {
                setImageUri(null);
                setFreshnessData(null);
              }}
            >
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
            {(analyzing || recognizing) && (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.analyzingText}>
                  {recognizing ? 'Recognizing food...' : 'Analyzing freshness...'}
                </Text>
              </View>
            )}
            {freshnessData && !analyzing && (
              <View style={styles.freshnessBadge}>
                <Text style={styles.freshnessLabel}>{freshnessData.freshness_label}</Text>
                <Text style={styles.freshnessScore}>{freshnessData.freshness_score}/100</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.cameraButtons}>
            <TouchableOpacity
              style={styles.cameraBox}
              onPress={takePhoto}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <Feather name="camera" size={32} color={theme.colors.primary} />
              <Text style={styles.cameraText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cameraBox, styles.galleryBox]}
              onPress={pickImage}
              accessibilityRole="button"
              accessibilityLabel="Pick from gallery"
            >
              <Feather name="image" size={32} color={theme.colors.primary} />
              <Text style={styles.cameraText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
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
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save Item</Text>
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.buttonRadius,
    ...theme.shadow.card,
  },
  templateButtonText: {
    fontFamily: theme.typography.medium,
    fontSize: 12,
    color: theme.colors.primary,
  },
  cancelButton: {
    padding: theme.spacing.xs,
  },
  templatesContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.cardRadius,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.card,
  },
  templatesTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  templateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.shapes.inputRadius,
    padding: theme.spacing.md,
    marginRight: theme.spacing.sm,
    minWidth: 80,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  templateEmoji: {
    fontSize: 32,
    marginBottom: theme.spacing.xs,
  },
  templateName: {
    fontFamily: theme.typography.medium,
    fontSize: 12,
    color: theme.colors.textPrimary,
    textAlign: 'center',
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
  cameraSection: {
    marginBottom: theme.spacing.lg,
  },
  cameraButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  cameraBox: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.cardRadius,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.xs,
    ...theme.shadow.card,
  },
  galleryBox: {
    borderColor: theme.colors.accent,
  },
  cameraText: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.textPrimary,
    fontSize: 14,
    marginTop: theme.spacing.xs,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: theme.shapes.cardRadius,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    ...theme.shadow.card,
  },
  previewImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  analyzingText: {
    fontFamily: theme.typography.medium,
    color: '#fff',
    fontSize: 14,
  },
  freshnessBadge: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.shapes.buttonRadius,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadow.card,
  },
  freshnessLabel: {
    fontFamily: theme.typography.semibold,
    color: '#fff',
    fontSize: 14,
  },
  freshnessScore: {
    fontFamily: theme.typography.regular,
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
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


