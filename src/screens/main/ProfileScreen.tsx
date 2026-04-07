import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Animated, Easing, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import Card from '../../components/Card';
import Button from '../../components/Button';

const GOAL_LABELS = ['Muscle Gain', 'Fat Loss', 'Recomposition', 'Endurance'];
const ENV_LABELS  = ['Gym', 'Home'];

// DB stores metric — convert for display/input
function kgToLbs(kg: number | null): string { return kg ? Math.round(kg * 2.20462).toString() : '—'; }
function cmToFt(cm: number | null): string  { return cm ? (cm / 30.48).toFixed(1) : '—'; }
function lbsToKg(lbs: string): number { return parseFloat((parseFloat(lbs) * 0.453592).toFixed(1)); }
function ftToCm(ft: string): number   { return Math.round(parseFloat(ft) * 30.48); }

interface EditState {
  name: string;
  weight_lbs: string;
  height_ft: string;
  goal: number;
  environment: number;
}

export default function ProfileScreen() {
  const session = useAppStore((s) => s.session);
  const [profile, setProfile] = useState<any>(null);
  const [mealCount, setMealCount] = useState(0);

  // Edit modal
  const [editOpen, setEditOpen]   = useState(false);
  const [editField, setEditField] = useState<'profile' | 'goals'>('profile');
  const [edit, setEdit]           = useState<EditState>({ name: '', weight_kg: '', height_cm: '', goal: 0, environment: 0 });
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const slideAnim = useRef(new Animated.Value(300)).current;

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [profileRes, mealRes] = await Promise.all([
      supabase.from('profiles').select('name, weight_kg, height_cm, goal, environment, accountability_enabled, created_at').eq('id', user.id).single(),
      supabase.from('meal_logs').select('id', { count: 'exact' }).eq('user_id', user.id),
    ]);
    if (profileRes.data) {
      setProfile(profileRes.data);
      setEdit({
        name:        profileRes.data.name ?? '',
        weight_lbs:  profileRes.data.weight_kg ? Math.round(profileRes.data.weight_kg * 2.20462).toString() : '',
        height_ft:   profileRes.data.height_cm ? (profileRes.data.height_cm / 30.48).toFixed(1) : '',
        goal:        profileRes.data.goal       ?? 0,
        environment: profileRes.data.environment ?? 0,
      });
    }
    if (mealRes.count !== null) setMealCount(mealRes.count);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (field: 'profile' | 'goals') => {
    setEditField(field);
    setSaveMsg('');
    setEditOpen(true);
    slideAnim.setValue(300);
    Animated.timing(slideAnim, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const closeEdit = () => {
    Animated.timing(slideAnim, { toValue: 300, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setEditOpen(false));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const patch: Record<string, any> = {};
      if (editField === 'profile') {
        if (edit.name)       patch.name      = edit.name.trim();
        if (edit.weight_lbs) patch.weight_kg = lbsToKg(edit.weight_lbs);
        if (edit.height_ft)  patch.height_cm = ftToCm(edit.height_ft);
      } else {
        patch.goal        = edit.goal;
        patch.environment = edit.environment;
      }
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
      await load();
      setSaveMsg('Saved!');
      setTimeout(() => { closeEdit(); setSaveMsg(''); }, 800);
    } catch (e: any) {
      setSaveMsg(e.message ?? 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => { supabase.auth.signOut(); };

  const userName  = profile?.name ?? session?.user?.user_metadata?.name ?? 'User';
  const userEmail = session?.user?.email ?? '';
  const initial   = userName[0]?.toUpperCase() ?? '?';
  const daysActive = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
    : 0;

  const SETTINGS = [
    { label: 'Edit Profile',          onPress: () => openEdit('profile') },
    { label: 'Update Goals',          onPress: () => openEdit('goals') },
    { label: 'Notifications',         onPress: () => {} },
    { label: 'Privacy & Security',    onPress: () => {} },
    { label: 'Manage Subscription',   onPress: () => {} },
    { label: 'Help & Support',        onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Profile</Text>

        {/* User card */}
        <Card style={styles.userCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.userEmail}>{userEmail}</Text>
            </View>
            <TouchableOpacity style={styles.editBadge} onPress={() => openEdit('profile')}>
              <Text style={styles.editBadgeText}>Edit</Text>
            </TouchableOpacity>
          </View>
          {profile && (
            <View style={styles.profileStats}>
              <TouchableOpacity style={styles.profileStat} onPress={() => openEdit('profile')}>
                <Text style={styles.profileStatValue}>{kgToLbs(profile.weight_kg)}</Text>
                <Text style={styles.profileStatLabel}>lbs</Text>
              </TouchableOpacity>
              <View style={styles.profileStatDivider} />
              <TouchableOpacity style={styles.profileStat} onPress={() => openEdit('profile')}>
                <Text style={styles.profileStatValue}>{cmToFt(profile.height_cm)}</Text>
                <Text style={styles.profileStatLabel}>ft</Text>
              </TouchableOpacity>
              <View style={styles.profileStatDivider} />
              <TouchableOpacity style={styles.profileStat} onPress={() => openEdit('goals')}>
                <Text style={styles.profileStatValue}>{GOAL_LABELS[profile.goal ?? 0]}</Text>
                <Text style={styles.profileStatLabel}>Goal</Text>
              </TouchableOpacity>
              <View style={styles.profileStatDivider} />
              <TouchableOpacity style={styles.profileStat} onPress={() => openEdit('goals')}>
                <Text style={styles.profileStatValue}>{ENV_LABELS[profile.environment ?? 0]}</Text>
                <Text style={styles.profileStatLabel}>Training</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Journey stats */}
        <View style={styles.journeyGrid}>
          {[
            { label: 'Days Active',   value: String(daysActive) },
            { label: 'Meals Logged',  value: String(mealCount)  },
          ].map((s, i) => (
            <Card key={i} style={styles.journeyCard}>
              <Text style={styles.journeyValue}>{s.value}</Text>
              <Text style={styles.journeyLabel}>{s.label}</Text>
            </Card>
          ))}
        </View>

        {/* Accountability */}
        {profile?.accountability_enabled && (
          <Card style={styles.accountCard}>
            <View style={styles.accountRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountTitle}>Accountability Active</Text>
                <Text style={styles.accountDesc}>$10 charged every Monday you miss your weekly workout targets.</Text>
              </View>
              <View style={styles.accountDot} />
            </View>
          </Card>
        )}

        {/* Settings */}
        <Text style={styles.sectionTitle}>SETTINGS</Text>
        <Card style={styles.settingsCard}>
          {SETTINGS.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.settingsRow, i < SETTINGS.length - 1 && styles.settingsRowBorder]}
              onPress={item.onPress}
              activeOpacity={0.65}
            >
              <Text style={styles.settingsLabel}>{item.label}</Text>
              <Text style={styles.settingsArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </Card>

        <Button
          title="Log Out"
          variant="secondary"
          onPress={handleLogout}
          style={{ marginHorizontal: 22, marginTop: 20 }}
          textStyle={{ color: COLORS.red }}
        />
        <Text style={styles.version}>FitAI v1.0.0</Text>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── EDIT MODAL ── */}
      <Modal visible={editOpen} transparent animationType="none" onRequestClose={closeEdit}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeEdit} />
        <Animated.View style={[styles.editSheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.editHandle} />
          <Text style={styles.editTitle}>
            {editField === 'profile' ? 'Edit Profile' : 'Update Goals'}
          </Text>

          {editField === 'profile' ? (
            <View style={styles.fieldList}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={edit.name}
                  onChangeText={v => setEdit(e => ({ ...e, name: v }))}
                  placeholder="Your name"
                  placeholderTextColor={COLORS.text3}
                />
              </View>
              <View style={styles.fieldDivider} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Weight (lbs)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={edit.weight_lbs}
                  onChangeText={v => setEdit(e => ({ ...e, weight_lbs: v }))}
                  keyboardType="numeric"
                  placeholder="180"
                  placeholderTextColor={COLORS.text3}
                />
              </View>
              <View style={styles.fieldDivider} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Height (ft)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={edit.height_ft}
                  onChangeText={v => setEdit(e => ({ ...e, height_ft: v }))}
                  keyboardType="numeric"
                  placeholder="5.9"
                  placeholderTextColor={COLORS.text3}
                />
              </View>
            </View>
          ) : (
            <View style={styles.fieldList}>
              <Text style={styles.pickerLabel}>GOAL</Text>
              <View style={styles.chipRow}>
                {GOAL_LABELS.map((g, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.chip, edit.goal === i && styles.chipActive]}
                    onPress={() => setEdit(e => ({ ...e, goal: i }))}
                  >
                    <Text style={[styles.chipText, edit.goal === i && styles.chipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.pickerLabel, { marginTop: 20 }]}>TRAINING ENVIRONMENT</Text>
              <View style={styles.chipRow}>
                {ENV_LABELS.map((g, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.chip, edit.environment === i && styles.chipActive]}
                    onPress={() => setEdit(e => ({ ...e, environment: i }))}
                  >
                    <Text style={[styles.chipText, edit.environment === i && styles.chipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {saveMsg ? (
            <Text style={[styles.saveMsg, saveMsg === 'Saved!' && { color: COLORS.lime }]}>{saveMsg}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={closeEdit}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 20 },
  heading: { fontSize: 32, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: -0.5, paddingHorizontal: 22, paddingTop: 12, marginBottom: 20 },

  userCard: { marginHorizontal: 22 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '900', color: COLORS.black },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.text3, marginTop: 2 },
  editBadge: { backgroundColor: COLORS.surface3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  editBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.text2 },

  profileStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  profileStat: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6 },
  profileStatValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  profileStatLabel: { fontSize: 9, color: COLORS.text3, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileStatDivider: { width: 1, height: 28, backgroundColor: COLORS.border },

  journeyGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 22, marginTop: 12 },
  journeyCard: { flex: 1, alignItems: 'center', paddingVertical: 20 },
  journeyValue: { fontSize: 28, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  journeyLabel: { fontSize: 10, color: COLORS.text3, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 },

  accountCard: { marginHorizontal: 22, marginTop: 12, backgroundColor: 'rgba(255,71,87,0.05)', borderColor: 'rgba(255,71,87,0.15)' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accountTitle: { fontSize: 14, fontWeight: '700', color: COLORS.red, marginBottom: 4 },
  accountDesc: { fontSize: 12, color: COLORS.text2, lineHeight: 18 },
  accountDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.red },

  sectionTitle: { fontSize: 10, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5, paddingHorizontal: 22, marginTop: 24, marginBottom: 12 },
  settingsCard: { marginHorizontal: 22, padding: 0 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingsLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  settingsArrow: { fontSize: 20, color: COLORS.text3 },
  version: { fontSize: 11, color: COLORS.text3, textAlign: 'center', marginTop: 20 },

  // ── Edit modal
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  editSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40,
  },
  editHandle: { width: 36, height: 4, backgroundColor: COLORS.surface3, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  editTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text, marginBottom: 24 },

  fieldList: { backgroundColor: COLORS.surface, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  fieldLabel: { fontSize: 14, color: COLORS.text2, width: 110 },
  fieldInput: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  fieldDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: 16 },

  pickerLabel: { fontSize: 9, fontWeight: '700', color: COLORS.text3, letterSpacing: 1.5, paddingHorizontal: 16, paddingTop: 16, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.surface3, borderWidth: 1.5, borderColor: 'transparent' },
  chipActive: { borderColor: COLORS.lime, backgroundColor: COLORS.limeDim },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.text3 },
  chipTextActive: { color: COLORS.lime },

  saveMsg: { fontSize: 12, color: COLORS.red, textAlign: 'center', marginBottom: 10 },
  saveBtn: { backgroundColor: COLORS.lime, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.black },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelBtnText: { fontSize: 14, color: COLORS.text3 },
});
