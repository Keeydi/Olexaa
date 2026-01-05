import { Platform } from 'react-native';

// Backend is running on your Windows machine at 192.168.100.3:8000
// This IP must be reachable from your phone/emulator.
let API_BASE_URL = 'http://192.168.100.3:8000';

if (Platform.OS === 'android') {
  // Android emulator -> host machine
  API_BASE_URL = 'http://192.168.100.3:8000';
} else if (Platform.OS === 'web') {
  // Use the same host the web app is served from, but port 8000 for the backend
  const host = typeof window !== 'undefined' ? window.location.hostname : '192.168.100.3';
  API_BASE_URL = `http://${host}:8000`;
}

function buildFriendlyErrorMessage(response, rawText, defaultMessage) {
  // Network or empty response body
  if (!rawText) {
    if (!response) {
      return 'Unable to reach the server. Please check your connection.';
    }
    if (response.status === 404) {
      return 'Service is not available right now. Please try again later.';
    }
    return defaultMessage;
  }

  // Try to parse JSON error from FastAPI: {"detail": "message"}
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed.detail === 'string') {
      // Special-case the generic "Not Found"
      if (parsed.detail === 'Not Found') {
        return 'Service is not available right now. Please try again later.';
      }
      return parsed.detail;
    }
  } catch {
    // not JSON, fall through
  }

  // Fallback to plain text or default
  if (typeof rawText === 'string' && rawText.trim().length > 0) {
    return rawText;
  }

  return defaultMessage;
}

export async function fetchAiRecipes(pantryItems) {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pantry_items: pantryItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          expiry_date: item.expiry_date,
          status: item.status,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.recipes ?? [];
  } catch (error) {
    console.error('Error calling AI recipes endpoint', error);
    throw error;
  }
}

export async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = buildFriendlyErrorMessage(
        response,
        errorText,
        response.status === 401 ? 'Invalid email or password' : 'Unable to sign in. Please try again.'
      );
      throw new Error(message);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      // Usually fetch/network error
      throw new Error('Unable to reach the server. Please check your internet connection.');
    }
    throw error;
  }
}

export async function signup(name, email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = buildFriendlyErrorMessage(
        response,
        errorText,
        response.status === 400 ? 'Unable to create account. Please check your details.' : 'Unable to create account. Please try again.'
      );
      throw new Error(message);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check your internet connection.');
    }
    throw error;
  }
}

export async function fetchPantryItems() {
  try {
    const response = await fetch(`${API_BASE_URL}/pantry/items`);

    if (!response.ok) {
      const errorText = await response.text();
      const message = buildFriendlyErrorMessage(
        response,
        errorText,
        'Unable to load pantry items.'
      );
      throw new Error(message);
    }

    const data = await response.json();
    // Normalise IDs to strings for the frontend
    return (data || []).map((item) => ({
      ...item,
      id: String(item.id),
    }));
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check your internet connection.');
    }
    throw error;
  }
}

export async function createPantryItem(newItem) {
  try {
    const response = await fetch(`${API_BASE_URL}/pantry/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newItem),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = buildFriendlyErrorMessage(
        response,
        errorText,
        'Unable to add item. Please try again.'
      );
      throw new Error(message);
    }

    const data = await response.json();
    return { ...data, id: String(data.id) };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check your internet connection.');
    }
    throw error;
  }
}

export async function updatePantryItem(itemId, updatedItem) {
  try {
    const response = await fetch(`${API_BASE_URL}/pantry/items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedItem),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = buildFriendlyErrorMessage(
        response,
        errorText,
        'Unable to update item. Please try again.'
      );
      throw new Error(message);
    }

    const data = await response.json();
    return { ...data, id: String(data.id) };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check your internet connection.');
    }
    throw error;
  }
}

export async function deletePantryItem(itemId) {
  try {
    const response = await fetch(`${API_BASE_URL}/pantry/items/${itemId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = buildFriendlyErrorMessage(
        response,
        errorText,
        'Unable to delete item. Please try again.'
      );
      throw new Error(message);
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check your internet connection.');
    }
    throw error;
  }
}

export async function fetchWasteStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/stats/waste`);

    if (!response.ok) {
      const errorText = await response.text();
      const message = buildFriendlyErrorMessage(
        response,
        errorText,
        'Unable to load statistics.'
      );
      throw new Error(message);
    }

    const data = await response.json();
    const summary = data.summary || {
      total: '0 items',
      delta: '0%',
      saved_value: 0,
      wasted_value: 0,
      saved_value_formatted: '0.00',
      wasted_value_formatted: '0.00',
    };
    return {
      trend: Array.isArray(data.trend) ? data.trend : [],
      summary,
    };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check your internet connection.');
    }
    throw error;
  }
}

export async function fetchEnhancedWasteStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/stats/waste/enhanced`);

    if (!response.ok) {
      const errorText = await response.text();
      const message = buildFriendlyErrorMessage(
        response,
        errorText,
        'Unable to load enhanced statistics.'
      );
      throw new Error(message);
    }

    const data = await response.json();
    const summary = data.summary || {
      total: '0 items',
      delta: '0%',
      saved_value: 0,
      wasted_value: 0,
      saved_value_formatted: '0.00',
      wasted_value_formatted: '0.00',
    };
    return {
      trend: Array.isArray(data.trend) ? data.trend : [],
      summary,
      categoryBreakdown: Array.isArray(data.category_breakdown) ? data.category_breakdown : [],
    };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check your internet connection.');
    }
    throw error;
  }
}

export async function analyzeFreshness(imageUri) {
  try {
    let formData = new FormData();
    
    if (Platform.OS === 'web') {
      // For web, convert URI to File/Blob
      if (typeof imageUri === 'string' && imageUri.startsWith('http')) {
        const imageResponse = await fetch(imageUri);
        const blob = await imageResponse.blob();
        formData.append('file', blob, 'food-image.jpg');
      } else if (imageUri instanceof File || imageUri instanceof Blob) {
        formData.append('file', imageUri, 'food-image.jpg');
      } else {
        // Try to fetch as blob
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('file', blob, 'food-image.jpg');
      }
    } else {
      // For React Native (iOS/Android), imageUri is a local file path
      // FormData in React Native accepts file objects with uri, type, and name
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'food-image.jpg',
      });
    }

    const response = await fetch(`${API_BASE_URL}/ai/freshness`, {
      method: 'POST',
      body: formData,
      headers: Platform.OS !== 'web' ? {} : undefined, // Let browser set Content-Type with boundary for web
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = buildFriendlyErrorMessage(
        response,
        errorText,
        'Unable to analyze freshness.'
      );
      throw new Error(message);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check your internet connection.');
    }
    throw error;
  }
}

export async function recognizeFoodItem(imageUri) {
  try {
    let formData = new FormData();
    
    if (Platform.OS === 'web') {
      // For web, convert URI to File/Blob
      if (typeof imageUri === 'string' && imageUri.startsWith('http')) {
        const imageResponse = await fetch(imageUri);
        const blob = await imageResponse.blob();
        formData.append('file', blob, 'food-image.jpg');
      } else if (imageUri instanceof File || imageUri instanceof Blob) {
        formData.append('file', imageUri, 'food-image.jpg');
      } else {
        // Try to fetch as blob
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('file', blob, 'food-image.jpg');
      }
    } else {
      // For React Native (iOS/Android), imageUri is a local file path
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'food-image.jpg',
      });
    }

    const response = await fetch(`${API_BASE_URL}/ai/recognize`, {
      method: 'POST',
      body: formData,
      headers: Platform.OS !== 'web' ? {} : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = buildFriendlyErrorMessage(
        response,
        errorText,
        'Unable to recognize food item.'
      );
      throw new Error(message);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check your internet connection.');
    }
    throw error;
  }
}