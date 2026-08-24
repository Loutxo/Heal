import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export type MatchedFood = { food_id: number; name: string; confidence: 'high' | 'medium' };

export type PhotoAnalysisResult = {
  photo_path: string;
  local_uri: string;
  detected_foods: string[];
  matched: MatchedFood[];
  unmatched: string[];
};

// Retourne null si l'utilisateur annule la sélection de photo (pas une erreur) — le résultat
// distingue "annulé" de "aucun aliment reconnu" (matched/unmatched vides mais résultat non-null).
export async function pickAndAnalyzePhoto(
  userId: string,
  context: 'meal' | 'fridge',
  source: 'camera' | 'library'
): Promise<PhotoAnalysisResult | null> {
  const permission =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Heal n'a pas la permission d'accéder à " + (source === 'camera' ? "l'appareil photo" : 'vos photos') + '.');
  }

  const pickerOptions: ImagePicker.ImagePickerOptions = { quality: 0.6, allowsEditing: false };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(pickerOptions) : await ImagePicker.launchImageLibraryAsync(pickerOptions);

  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const photoPath = `${userId}/${context}-${Date.now()}.${extension}`;

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from('meal-photos').upload(photoPath, arrayBuffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw new Error("Échec de l'envoi de la photo : " + uploadError.message);

  const { data, error: analyzeError } = await supabase.functions.invoke('analyze-food-photo', {
    body: { photo_path: photoPath, context, mime_type: mimeType },
  });
  if (analyzeError || data?.error) {
    throw new Error(data?.error?.message ?? analyzeError?.message ?? "Échec de l'analyse de la photo.");
  }

  return { ...(data as Omit<PhotoAnalysisResult, 'local_uri'>), local_uri: asset.uri };
}
