import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import Card from '../../components/Card';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

interface ProgressPhoto {
  id: string;
  week_number: number;
  front_url: string | null;
  side_url: string | null;
  back_url: string | null;
  uploaded_at: string;
}

interface UploadState {
  front: boolean;
  side: boolean;
  back: boolean;
}

interface Profile {
  weight_kg: number | null;
  created_at: string;
}

const POSES: { key: keyof UploadState; label: string; hint: string }[] = [
  { key: 'front', label: 'Front', hint: 'Face camera' },
  { key: 'side', label: 'Side', hint: 'Turn 90°' },
  { key: 'back', label: 'Back', hint: 'Face away' },
];

function getWeekNumber(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export default function BodyScreen() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState<UploadState>({ front: false, side: false, back: false });
  const [previewUris, setPreviewUris] = useState<Partial<Record<keyof UploadState, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [thisWeekUploaded, setThisWeekUploaded] = useState<Partial<Record<keyof UploadState, boolean>>>({});
  const [comparePose, setComparePose] = useState<'front' | 'side' | 'back'>('front');
  const [weekWeight, setWeekWeight] = useState('');
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisWeek, setAnalysisWeek] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const currentWeek = profile?.created_at
    ? getWeekNumber(new Date(profile.created_at), new Date())
    : 1;

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [profileRes, photosRes] = await Promise.all([
      supabase.from('profiles').select('weight_kg, created_at, body_analysis, body_analysis_week').eq('id', user.id).single(),
      supabase.from('progress_photos').select('*').eq('user_id', user.id).order('week_number', { ascending: false }),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
      if (profileRes.data.body_analysis) setAnalysis(profileRes.data.body_analysis);
      if (profileRes.data.body_analysis_week) setAnalysisWeek(profileRes.data.body_analysis_week);
    }
    if (photosRes.data) {
      setPhotos(photosRes.data);
      // Check if current week already has photos
      const thisWeek = photosRes.data.find((p: ProgressPhoto) => p.week_number === currentWeek);
      if (thisWeek) {
        setThisWeekUploaded({
          front: !!thisWeek.front_url,
          side: !!thisWeek.side_url,
          back: !!thisWeek.back_url,
        });
      }
    }
    setLoading(false);
  }, [currentWeek]);

  useEffect(() => { load(); }, [load]);

  const handlePick = async (pose: keyof UploadState) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPreviewUris((prev) => ({ ...prev, [pose]: asset.uri }));
  };

  const handleSubmitWeek = async () => {
    const allSelected = POSES.every((p) => previewUris[p.key] || thisWeekUploaded[p.key]);
    if (!allSelected) {
      Alert.alert('Upload all 3 photos', 'Front, side, and back are required for the weekly check-in.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const paths: Partial<Record<string, string>> = {};

      for (const pose of POSES) {
        const uri = previewUris[pose.key];
        if (!uri) continue;

        const response = await fetch(uri);
        const blob = await response.blob();

        // Determine mime type and extension from blob or URI
        const mimeType = blob.type || 'image/jpeg';
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
        const path = `${user.id}/week${currentWeek}_${pose.key}.${ext}`;

        const { error } = await supabase.storage
          .from('body-photos')
          .upload(path, blob, { upsert: true, contentType: mimeType });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from('body-photos').getPublicUrl(path);
        paths[`${pose.key}_url`] = publicUrl;
      }

      await supabase.from('progress_photos').upsert({
        user_id: user.id,
        week_number: currentWeek,
        ...paths,
        uploaded_at: new Date().toISOString(),
      }, { onConflict: 'user_id, week_number' });

      // Save weight if entered
      if (weekWeight && parseFloat(weekWeight) > 0) {
        const weightKg = parseFloat((parseFloat(weekWeight) * 0.453592).toFixed(1));
        await supabase.from('profiles').update({ weight_kg: weightKg }).eq('id', user.id);
      }

      setPreviewUris({});
      setWeekWeight('');
      await load();
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? JSON.stringify(err));
    } finally {
      setSaving(false);
    }
  };

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from('body-photos').createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-progress`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data.analysis);
      setAnalysisWeek(data.week);
    } catch (err: any) {
      Alert.alert('Analysis failed', err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const allNewSelected = POSES.every((p) => previewUris[p.key] || thisWeekUploaded[p.key]);
  const uploadedCount = POSES.filter((p) => previewUris[p.key] || thisWeekUploaded[p.key]).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.lime} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.heading}>Body</Text>
          <Text style={styles.subheading}>Progress</Text>
        </View>

        {/* Weekly check-in */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>WEEK {currentWeek} CHECK-IN</Text>
          <Text style={styles.sectionSub}>{uploadedCount}/3 photos</Text>
        </View>

        <View style={styles.poseRow}>
          {POSES.map((pose) => {
            const uri = previewUris[pose.key];
            const alreadyDone = thisWeekUploaded[pose.key];
            return (
              <TouchableOpacity
                key={pose.key}
                style={[styles.poseCard, (uri || alreadyDone) && styles.poseCardDone]}
                onPress={() => handlePick(pose.key)}
                activeOpacity={0.75}
              >
                {uri ? (
                  <Image source={{ uri }} style={styles.poseImage} />
                ) : alreadyDone ? (
                  <View style={styles.poseDoneIndicator}>
                    <Text style={styles.poseDoneCheck}>✓</Text>
                  </View>
                ) : (
                  <View style={styles.posePlaceholder}>
                    <Text style={styles.posePlus}>+</Text>
                  </View>
                )}
                <Text style={styles.poseLabel}>{pose.label}</Text>
                <Text style={styles.poseHint}>
                  {uri ? 'Ready' : alreadyDone ? 'Uploaded' : pose.hint}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Weight update */}
        <View style={styles.weightRow}>
          <Text style={styles.weightLabel}>This week's weight</Text>
          <View style={styles.weightInputWrap}>
            <TextInput
              style={styles.weightInput}
              value={weekWeight}
              onChangeText={setWeekWeight}
              keyboardType="numeric"
              placeholder={profile?.weight_kg ? Math.round(profile.weight_kg * 2.20462).toString() : '180'}
              placeholderTextColor={COLORS.text3}
            />
            <Text style={styles.weightUnit}>lbs</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (!allNewSelected || saving) && styles.submitBtnDisabled]}
          onPress={handleSubmitWeek}
          disabled={!allNewSelected || saving}
        >
          {saving
            ? <ActivityIndicator color={COLORS.black} size="small" />
            : <Text style={styles.submitBtnText}>
                {uploadedCount === 3 && Object.keys(previewUris).length === 0
                  ? 'Week ' + currentWeek + ' Submitted'
                  : 'Submit Week ' + currentWeek + ' Check-in'}
              </Text>
          }
        </TouchableOpacity>

        {/* AI Body Analysis */}
        <View style={styles.analysisSection}>
          <View style={styles.analysisTitleRow}>
            <Text style={styles.analysisSectionTitle}>AI COACH ANALYSIS</Text>
            {analysisWeek && <Text style={styles.analysisWeekTag}>Week {analysisWeek}</Text>}
          </View>
          {analysis ? (
            <View style={styles.analysisCard}>
              <Text style={styles.analysisText}>{analysis}</Text>
              <TouchableOpacity style={styles.reAnalyzeBtn} onPress={handleAnalyze} disabled={analyzing}>
                {analyzing
                  ? <ActivityIndicator color={COLORS.lime} size="small" />
                  : <Text style={styles.reAnalyzeBtnText}>Refresh Analysis</Text>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze} disabled={analyzing}>
              {analyzing ? (
                <View style={styles.analyzingRow}>
                  <ActivityIndicator color={COLORS.black} size="small" />
                  <Text style={styles.analyzeBtnText}>Analyzing your body...</Text>
                </View>
              ) : (
                <Text style={styles.analyzeBtnText}>Get AI Body Analysis</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Side-by-side comparison */}
        {photos.length >= 2 && (() => {
          const first = photos[photos.length - 1]; // oldest = week 1
          const latest = photos[0];                // newest
          const poseKey = `${comparePose}_url` as keyof ProgressPhoto;
          const firstUrl = first[poseKey] as string | null;
          const latestUrl = latest[poseKey] as string | null;
          return (
            <>
              <Text style={styles.sectionTitle2}>TRANSFORMATION</Text>
              <View style={styles.compareRow}>
                {[{ label: `Week ${first.week_number}`, url: firstUrl, date: first.uploaded_at },
                  { label: `Week ${latest.week_number}`, url: latestUrl, date: latest.uploaded_at }
                ].map((item, i) => (
                  <View key={i} style={styles.compareCol}>
                    <TouchableOpacity style={styles.compareImgWrap} onPress={() => item.url && setViewerUrl(item.url)} activeOpacity={0.85}>
                      {item.url ? (
                        <Image source={{ uri: item.url }} style={styles.compareImg} />
                      ) : (
                        <View style={[styles.compareImg, styles.compareImgEmpty]}>
                          <Text style={styles.compareEmptyText}>No photo</Text>
                        </View>
                      )}
                      <View style={styles.compareWeekBadge}>
                        <Text style={styles.compareWeekText}>{item.label}</Text>
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.compareDate}>
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.poseTabRow}>
                {(['front', 'side', 'back'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.poseTab, comparePose === p && styles.poseTabActive]}
                    onPress={() => setComparePose(p)}
                  >
                    <Text style={[styles.poseTabText, comparePose === p && styles.poseTabTextActive]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          );
        })()}

        {/* Stats from profile */}
        {profile?.weight_kg && (
          <>
            <Text style={styles.sectionTitle2}>CURRENT STATS</Text>
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{Math.round(profile.weight_kg * 2.20462)}</Text>
                <Text style={styles.statUnit}>lbs</Text>
                <Text style={styles.statLabel}>Weight</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{currentWeek}</Text>
                <Text style={styles.statUnit}>wks</Text>
                <Text style={styles.statLabel}>Active</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{photos.length}</Text>
                <Text style={styles.statUnit}>logs</Text>
                <Text style={styles.statLabel}>Check-ins</Text>
              </Card>
            </View>
          </>
        )}

        {/* Past weeks */}
        {photos.length > 0 && (
          <>
            <Text style={styles.sectionTitle2}>PROGRESS HISTORY</Text>
            <View style={styles.historyList}>
              {photos.map((photo) => (
                <Card key={photo.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyWeek}>Week {photo.week_number}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(photo.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={styles.historyPhotos}>
                    {(['front_url', 'side_url', 'back_url'] as const).map((key, i) => {
                      const url = photo[key as keyof ProgressPhoto] as string | null;
                      const labels = ['Front', 'Side', 'Back'];
                      return (
                        <TouchableOpacity key={i} style={styles.historyPhoto} onPress={() => url && setViewerUrl(url)} activeOpacity={0.85}>
                          {url ? (
                            <Image source={{ uri: url }} style={styles.historyImg} />
                          ) : (
                            <View style={[styles.historyImg, styles.historyImgEmpty]} />
                          )}
                          <Text style={styles.historyPhotoLabel}>{labels[i]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
      {/* Full-screen photo viewer */}
      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <TouchableOpacity style={styles.viewerOverlay} activeOpacity={1} onPress={() => setViewerUrl(null)}>
          {viewerUrl && <Image source={{ uri: viewerUrl }} style={styles.viewerImg} resizeMode="contain" />}
          <View style={styles.viewerClose}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 4 },
  heading: { fontSize: 32, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5, lineHeight: 34 },
  subheading: { fontSize: 32, fontWeight: '900', color: COLORS.lime, textTransform: 'uppercase', letterSpacing: -0.5, lineHeight: 34, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5 },
  sectionSub: { fontSize: 11, color: COLORS.text3 },
  sectionTitle2: { fontSize: 10, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5, paddingHorizontal: 22, marginTop: 24, marginBottom: 12 },
  poseRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22 },
  poseCard: {
    flex: 1, backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 16, alignItems: 'center', padding: 12, gap: 6,
  },
  poseCardDone: { borderColor: COLORS.lime, backgroundColor: COLORS.limeDim },
  posePlaceholder: {
    width: 56, height: 72, backgroundColor: COLORS.surface3, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  posePlus: { fontSize: 24, color: COLORS.text3 },
  poseImage: { width: 56, height: 72, borderRadius: 10 },
  poseDoneIndicator: {
    width: 56, height: 72, backgroundColor: COLORS.limeDim, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  poseDoneCheck: { fontSize: 24, color: COLORS.lime },
  poseLabel: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  poseHint: { fontSize: 9, color: COLORS.text3 },
  submitBtn: {
    marginHorizontal: 22, marginTop: 16, height: 52, backgroundColor: COLORS.lime,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.35 },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  weightRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 22, marginTop: 14, marginBottom: 4,
    backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  weightLabel: { fontSize: 13, color: COLORS.text2, fontWeight: '500' },
  weightInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weightInput: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'right', minWidth: 50 },
  weightUnit: { fontSize: 13, color: COLORS.text3 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue: { fontSize: 24, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  statUnit: { fontSize: 10, color: COLORS.text3, marginTop: 1 },
  statLabel: { fontSize: 9, color: COLORS.text3, letterSpacing: 0.8, marginTop: 4, textTransform: 'uppercase' },
  historyList: { paddingHorizontal: 22, gap: 10 },
  historyCard: { padding: 14 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  historyWeek: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  historyDate: { fontSize: 11, color: COLORS.text3 },
  historyPhotos: { flexDirection: 'row', gap: 8 },
  historyPhoto: { flex: 1, alignItems: 'center', gap: 4 },
  historyImg: { width: '100%', height: 90, borderRadius: 10 },
  historyImgEmpty: { backgroundColor: COLORS.surface3 },
  historyPhotoLabel: { fontSize: 9, color: COLORS.text3 },
  compareRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22 },
  compareCol: { flex: 1, alignItems: 'center', gap: 6 },
  compareImgWrap: { width: '100%', position: 'relative' },
  compareImg: { width: '100%', height: 220, borderRadius: 16 },
  compareImgEmpty: { backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center' },
  compareEmptyText: { fontSize: 11, color: COLORS.text3 },
  compareWeekBadge: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  compareWeekText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  compareDate: { fontSize: 10, color: COLORS.text3 },
  poseTabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, marginTop: 12, justifyContent: 'center' },
  poseTab: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border,
  },
  poseTabActive: { backgroundColor: COLORS.limeDim, borderColor: COLORS.lime },
  poseTabText: { fontSize: 12, fontWeight: '600', color: COLORS.text3 },
  poseTabTextActive: { color: COLORS.lime },
  analysisSection: { paddingHorizontal: 22, marginTop: 24 },
  analysisTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  analysisSectionTitle: { fontSize: 10, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5 },
  analysisWeekTag: { fontSize: 10, fontWeight: '600', color: COLORS.lime, backgroundColor: COLORS.limeDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  analysisCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: 'rgba(200,255,0,0.15)',
    borderRadius: 16, padding: 18,
  },
  analysisText: { fontSize: 14, color: COLORS.text2, lineHeight: 24, letterSpacing: 0.1 },
  reAnalyzeBtn: { marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: COLORS.lime },
  reAnalyzeBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.lime },
  analyzeBtn: {
    backgroundColor: COLORS.lime, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analyzeBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '85%' },
  viewerClose: { position: 'absolute', top: 52, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  viewerCloseText: { fontSize: 16, color: '#fff', fontWeight: '700' },
});
