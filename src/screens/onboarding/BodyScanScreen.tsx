import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Button';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BodyScan'>;

const POSES = [
  { label: 'Front', desc: 'Face the camera, arms out', tip: 'Wear fitted clothes' },
  { label: 'Side', desc: 'Turn 90° to your left', tip: 'Stand tall, natural posture' },
  { label: 'Back', desc: 'Face away from camera', tip: 'Feet shoulder-width apart' },
];

type PhotoState = {
  uri: string | null;
  uploading: boolean;
  uploaded: boolean;
};

const defaultPhoto = (): PhotoState => ({ uri: null, uploading: false, uploaded: false });

export default function BodyScanScreen({ navigation }: Props) {
  const [photos, setPhotos] = useState<PhotoState[]>([defaultPhoto(), defaultPhoto(), defaultPhoto()]);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const updatePhoto = (index: number, patch: Partial<PhotoState>) => {
    setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const handlePick = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission required', 'Allow photo access to upload body photos.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.6,
      exif: false,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    updatePhoto(index, { uri: asset.uri, uploading: true, uploaded: false });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const pose = POSES[index].label.toLowerCase();
      // Save as week1_ prefix so it links with progress photo system
      const path = `${user.id}/week1_${pose}.jpg`;
      const uploadBlob = await fetch(asset.uri).then(r => r.blob());

      const { error } = await supabase.storage
        .from('body-photos')
        .upload(path, uploadBlob, { upsert: true, contentType: 'image/jpeg' });

      if (error) throw error;

      // Update week 1 progress_photos row with the newly uploaded pose URL
      const { data: { publicUrl } } = supabase.storage
        .from('body-photos').getPublicUrl(path);
      await supabase.from('progress_photos').upsert({
        user_id: user.id,
        week_number: 1,
        [`${pose}_url`]: publicUrl,
        uploaded_at: new Date().toISOString(),
      }, { onConflict: 'user_id, week_number' });

      updatePhoto(index, { uploading: false, uploaded: true });
    } catch (err: any) {
      updatePhoto(index, { uploading: false, uploaded: false, uri: null });
      Alert.alert('Upload failed', err.message);
    }
  };

  const uploadedCount = photos.filter((p) => p.uploaded).length;
  const allUploaded = uploadedCount === 3;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.label}>STEP 1 OF 2</Text>
        <Text style={styles.heading}>Body{'\n'}Scan</Text>
        <Text style={styles.subtitle}>
          Upload 3 photos so our AI can analyze your physique and build a truly personalized plan.
        </Text>

        {/* Why it matters */}
        <View style={styles.whyCard}>
          <View style={styles.whyRow}>
            <View style={styles.whyDot} />
            <Text style={styles.whyText}>AI identifies muscle imbalances and weak points</Text>
          </View>
          <View style={styles.whyRow}>
            <View style={styles.whyDot} />
            <Text style={styles.whyText}>Workouts target your specific body composition</Text>
          </View>
          <View style={styles.whyRow}>
            <View style={styles.whyDot} />
            <Text style={styles.whyText}>AES-256 encrypted · Seen only by AI, never shared</Text>
          </View>
        </View>

        <View style={styles.cards}>
          {POSES.map((pose, i) => {
            const photo = photos[i];
            return (
              <TouchableOpacity
                key={i}
                onPress={() => !photo.uploading && handlePick(i)}
                style={[styles.photoCard, photo.uploaded && styles.photoCardDone]}
                activeOpacity={0.75}
              >
                <View style={styles.photoPlaceholder}>
                  {photo.uploading ? (
                    <ActivityIndicator color={COLORS.lime} />
                  ) : photo.uri ? (
                    <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                  ) : (
                    <Text style={styles.uploadIcon}>+</Text>
                  )}
                </View>
                <Text style={styles.poseLabel}>{pose.label}</Text>
                <Text style={styles.poseDesc}>
                  {photo.uploading ? 'Uploading...' : photo.uploaded ? '✓ Done' : pose.desc}
                </Text>
                {!photo.uploaded && !photo.uploading && (
                  <Text style={styles.poseTip}>{pose.tip}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.progressRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.progressDot, i < uploadedCount && styles.progressDotDone]} />
          ))}
          <Text style={styles.progress}>{uploadedCount}/3 photos uploaded</Text>
        </View>

        <View style={{ marginTop: 'auto' }}>
          <Button
            title={allUploaded ? 'Next: Your Profile →' : `Upload All 3 Photos (${uploadedCount}/3)`}
            onPress={() => navigation.navigate('Setup')}
            disabled={!allUploaded}
          />

          {/* Skip — hidden by default, shown only after tapping */}
          {!showSkipConfirm ? (
            <TouchableOpacity style={styles.skipLink} onPress={() => setShowSkipConfirm(true)}>
              <Text style={styles.skipLinkText}>Skip photos (less accurate plan)</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipConfirm}>
              <Text style={styles.skipConfirmText}>
                Without photos, AI uses only your stats. Your plan will be less personalized.
              </Text>
              <View style={styles.skipConfirmRow}>
                <TouchableOpacity style={styles.skipConfirmNo} onPress={() => setShowSkipConfirm(false)}>
                  <Text style={styles.skipConfirmNoText}>Add Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipConfirmYes} onPress={() => navigation.navigate('Setup')}>
                  <Text style={styles.skipConfirmYesText}>Skip Anyway</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },
  backButton: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  backText: { color: COLORS.text, fontSize: 18 },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  heading: { fontSize: 34, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5, lineHeight: 36, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.text2, lineHeight: 22, marginBottom: 14 },
  whyCard: {
    backgroundColor: COLORS.surface2, borderRadius: 16, padding: 14, marginBottom: 20, gap: 8,
  },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  whyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.lime },
  whyText: { fontSize: 12, color: COLORS.text2, flex: 1, lineHeight: 18 },
  cards: { flexDirection: 'row', gap: 10 },
  photoCard: {
    flex: 1, backgroundColor: COLORS.surface2, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 18, padding: 12, alignItems: 'center',
  },
  photoCardDone: { borderColor: COLORS.lime, backgroundColor: COLORS.limeDim },
  photoPlaceholder: {
    width: 56, height: 72, backgroundColor: COLORS.surface3, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden',
  },
  photoPreview: { width: 56, height: 72, borderRadius: 10 },
  uploadIcon: { fontSize: 26, color: COLORS.text3 },
  poseLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  poseDesc: { fontSize: 9, color: COLORS.text3, textAlign: 'center' },
  poseTip: { fontSize: 9, color: COLORS.text3, textAlign: 'center', marginTop: 2, fontStyle: 'italic' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 4 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.surface3 },
  progressDotDone: { backgroundColor: COLORS.lime },
  progress: { fontSize: 12, color: COLORS.text3, marginLeft: 4 },
  skipLink: { alignItems: 'center', paddingVertical: 12 },
  skipLinkText: { fontSize: 12, color: COLORS.text3, textDecorationLine: 'underline' },
  skipConfirm: {
    backgroundColor: COLORS.surface2, borderRadius: 16, padding: 16, marginTop: 8,
  },
  skipConfirmText: { fontSize: 13, color: COLORS.text2, lineHeight: 20, marginBottom: 12 },
  skipConfirmRow: { flexDirection: 'row', gap: 10 },
  skipConfirmNo: {
    flex: 1, backgroundColor: COLORS.lime, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  skipConfirmNoText: { fontSize: 13, fontWeight: '700', color: COLORS.black },
  skipConfirmYes: {
    flex: 1, backgroundColor: COLORS.surface3, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  skipConfirmYesText: { fontSize: 13, fontWeight: '600', color: COLORS.text3 },
});
