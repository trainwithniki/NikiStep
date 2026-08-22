(function () {
  'use strict';
  const cfg = window.NIKI_CONFIG;
  if (!cfg || !window.supabase) return console.error('Supabase configuration is missing.');
  const rememberKey = 'niki-remember-admin';
  const bookingReceiptsKey = 'niki-booking-receipts-v1';
  const authStorage = {
    getItem(key) { return (localStorage.getItem(rememberKey) !== '0' ? localStorage : sessionStorage).getItem(key); },
    setItem(key, value) { return (localStorage.getItem(rememberKey) !== '0' ? localStorage : sessionStorage).setItem(key, value); },
    removeItem(key) { localStorage.removeItem(key); sessionStorage.removeItem(key); }
  };
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, storage: authStorage }
  });
  const isAdminPage = /admin(?:\.html)?$/.test(location.pathname);
  const defaultSiteSettings = { heroText: 'MOVE. SWEAT.\nFEEL GOOD.', heroSubtitle: 'Енергична тренировка с музика, движение и настроение във Fit Body Center.' };
  const defaultPaymentRates = { multisport: 1.70, individual: 3.75 };
  const defaultManualPaymentTemplates = [
    { id: 'pilates-mon', name: 'Пилатес Понеделник', title: 'Пилатес Понеделник', location: 'Fitness Line', time: '07:45', multisportRate: 1.70, individualRate: 3.75, card8Rate: 3.06, card12Rate: 2.54, sortOrder: 1 },
    { id: 'pilates-fri', name: 'Пилатес Петък', title: 'Пилатес Петък', location: 'Fitness Line', time: '07:45', multisportRate: 1.70, individualRate: 3.75, card8Rate: 3.06, card12Rate: 2.54, sortOrder: 2 },
    { id: 'step-fl-mon', name: 'STEP FL Пон', title: 'STEP FL Пон', location: 'Fitness Line', time: '18:30', multisportRate: 1.33, individualRate: 2.73, card8Rate: null, card12Rate: null, sortOrder: 3 },
    { id: 'step-fl-fri', name: 'STEP FL Пт', title: 'STEP FL Пт', location: 'Fitness Line', time: '18:30', multisportRate: 1.33, individualRate: 2.73, card8Rate: null, card12Rate: null, sortOrder: 4 }
  ];
  let cache = { sessions: [], siteSettings: { ...defaultSiteSettings }, paymentAdjustments: {}, paymentRates: { ...defaultPaymentRates }, manualPaymentSessions: [], manualPaymentTemplates: JSON.parse(JSON.stringify(defaultManualPaymentTemplates)), paymentsConfigured: false, manualPaymentsConfigured: false, manualPaymentTemplatesConfigured: false };
  let ready = false;
  const cancelTokens = new Map();
  const isTrue = value => value === true || value === 'true' || value === 1 || value === '1';
  const readReceipts = () => { try { return JSON.parse(localStorage.getItem(bookingReceiptsKey) || '{}'); } catch (_) { return {}; } };
  const writeReceipts = receipts => localStorage.setItem(bookingReceiptsKey, JSON.stringify(receipts));

  const fromRow = row => ({
    id: row.id, date: String(row.date), time: String(row.time).slice(0, 5),
    title: row.title, trainer: row.trainer, location: row.location,
    duration: row.duration, capacity: row.capacity, bookingClosed: row.booking_closed,
    forceOpen: row.force_open, bookingDays: row.booking_days,
    bookingCloseHours: Number(row.booking_close_hours), announcement: row.announcement,
    description: row.description, registrations: []
  });
  const toRow = session => ({
    id: session.id, date: session.date, time: session.time, title: session.title,
    trainer: session.trainer, location: session.location, duration: Number(session.duration),
    capacity: Number(session.capacity), booking_closed: !!session.bookingClosed,
    force_open: !!session.forceOpen, booking_days: Number(session.bookingDays || 2),
    booking_close_hours: Number(session.bookingCloseHours || 0),
    announcement: session.announcement || '', description: session.description || ''
  });
  const fromManualPaymentRow = row => ({
    id: String(row.id), date: String(row.date), time: String(row.time).slice(0, 5),
    title: row.title, location: row.location, templateId: row.template_id || '',
    multisportCount: Number(row.multisport_count) || 0,
    individualCount: Number(row.individual_count) || 0,
    card8Count: Number(row.card8_count) || 0,
    card12Count: Number(row.card12_count) || 0,
    multisportRate: Number(row.multisport_rate) || 0,
    individualRate: Number(row.individual_rate) || 0,
    card8Rate: row.card8_rate === null || row.card8_rate === undefined ? null : Number(row.card8_rate),
    card12Rate: row.card12_rate === null || row.card12_rate === undefined ? null : Number(row.card12_rate)
  });
  const toManualPaymentRow = item => ({
    id: item.id, date: item.date, time: item.time || '18:30',
    title: item.title || 'Step Aerobics with Niki', location: item.location || 'Fitness Line',
    template_id: item.templateId || null,
    multisport_count: Math.max(0, Number(item.multisportCount) || 0),
    individual_count: Math.max(0, Number(item.individualCount) || 0),
    card8_count: Math.max(0, Number(item.card8Count) || 0),
    card12_count: Math.max(0, Number(item.card12Count) || 0),
    multisport_rate: Math.max(0, Number(item.multisportRate) || 0),
    individual_rate: Math.max(0, Number(item.individualRate) || 0),
    card8_rate: item.card8Rate === null || item.card8Rate === undefined ? null : Math.max(0, Number(item.card8Rate) || 0),
    card12_rate: item.card12Rate === null || item.card12Rate === undefined ? null : Math.max(0, Number(item.card12Rate) || 0),
    updated_at: new Date().toISOString()
  });
  const fromManualPaymentTemplateRow = row => ({
    id: String(row.id), name: String(row.name), title: String(row.title), location: String(row.location), time: String(row.time).slice(0, 5),
    multisportRate: Number(row.multisport_rate) || 0, individualRate: Number(row.individual_rate) || 0,
    card8Rate: row.card8_rate === null ? null : Number(row.card8_rate), card12Rate: row.card12_rate === null ? null : Number(row.card12_rate), sortOrder: Number(row.sort_order) || 0
  });
  const toManualPaymentTemplateRow = item => ({
    id: String(item.id), name: String(item.name).trim(), title: String(item.title).trim(), location: String(item.location).trim(), time: String(item.time).slice(0, 5),
    multisport_rate: Math.max(0, Number(item.multisportRate) || 0), individual_rate: Math.max(0, Number(item.individualRate) || 0),
    card8_rate: item.card8Rate === null ? null : Math.max(0, Number(item.card8Rate) || 0), card12_rate: item.card12Rate === null ? null : Math.max(0, Number(item.card12Rate) || 0),
    sort_order: Number(item.sortOrder) || 0, updated_at: new Date().toISOString()
  });

  async function refresh() {
    let sessions;
    let paymentAdjustments = {};
    let paymentRates = { ...defaultPaymentRates };
    let manualPaymentSessions = [];
    let manualPaymentTemplates = JSON.parse(JSON.stringify(defaultManualPaymentTemplates));
    let paymentsConfigured = !isAdminPage;
    let manualPaymentsConfigured = !isAdminPage;
    let manualPaymentTemplatesConfigured = !isAdminPage;
    if (isAdminPage) {
      const result = await client.from('sessions').select('*').order('date');
      if (result.error) throw result.error;
      sessions = result.data.map(fromRow);
      const regs = await client.from('registrations').select('*').order('created_at');
      if (regs.error) throw regs.error;
      regs.data.forEach(row => {
        const session = sessions.find(item => item.id === row.session_id);
        if (session) session.registrations.push({ id: row.id, name: row.name, phone: row.phone, hasMultisport: isTrue(row.has_multisport), pending: row.pending, createdAt: row.created_at, cancelledAt: row.cancelled_at || null, bookedBy: row.booked_by || '' });
      });
      const payments = await client.from('payment_adjustments').select('session_id,extra_individual,extra_multisport');
      if (payments.error) {
        const missing = payments.error.code === '42P01' || payments.error.code === 'PGRST205' || /payment_adjustments/i.test(String(payments.error.message || ''));
        if (!missing) throw payments.error;
        paymentsConfigured = false;
      } else {
        paymentsConfigured = true;
        (payments.data || []).forEach(row => {
          paymentAdjustments[row.session_id] = { individual: Number(row.extra_individual) || 0, multisport: Number(row.extra_multisport) || 0 };
        });
      }
      const rates = await client.from('payment_config').select('multisport_rate,individual_rate').eq('id', 'default').maybeSingle();
      if (rates.error) {
        const missing = rates.error.code === '42P01' || rates.error.code === 'PGRST205' || /payment_config/i.test(String(rates.error.message || ''));
        if (!missing) throw rates.error;
        paymentsConfigured = false;
      } else if (rates.data) {
        paymentRates = { multisport: Number(rates.data.multisport_rate), individual: Number(rates.data.individual_rate) };
      }
      let manualPayments = await client.from('manual_payment_sessions').select('id,date,time,title,location,template_id,multisport_count,individual_count,card8_count,card12_count,multisport_rate,individual_rate,card8_rate,card12_rate').order('date');
      if (manualPayments.error) {
        const missing = manualPayments.error.code === '42P01' || manualPayments.error.code === 'PGRST205' || /manual_payment_sessions/i.test(String(manualPayments.error.message || ''));
        const oldColumns = manualPayments.error.code === '42703' || manualPayments.error.code === 'PGRST204' || /(template_id|card8_count|card12_count|card8_rate|card12_rate)/i.test(String(manualPayments.error.message || ''));
        if (!missing && !oldColumns) throw manualPayments.error;
        manualPaymentsConfigured = false;
        if (oldColumns) {
          manualPayments = await client.from('manual_payment_sessions').select('id,date,time,title,location,multisport_count,individual_count,multisport_rate,individual_rate').order('date');
          if (!manualPayments.error) manualPaymentSessions = (manualPayments.data || []).map(fromManualPaymentRow);
        }
      } else {
        manualPaymentsConfigured = true;
        manualPaymentSessions = (manualPayments.data || []).map(fromManualPaymentRow);
      }
      const manualTemplates = await client.from('manual_payment_templates').select('id,name,title,location,time,multisport_rate,individual_rate,card8_rate,card12_rate,sort_order').order('sort_order');
      if (manualTemplates.error) {
        const missing = manualTemplates.error.code === '42P01' || manualTemplates.error.code === 'PGRST205' || /manual_payment_templates/i.test(String(manualTemplates.error.message || ''));
        if (!missing) throw manualTemplates.error;
        manualPaymentTemplatesConfigured = false;
      } else {
        manualPaymentTemplatesConfigured = true;
        if ((manualTemplates.data || []).length) manualPaymentTemplates = manualTemplates.data.map(fromManualPaymentTemplateRow);
      }
    } else {
      const result = await client.rpc('public_sessions');
      if (result.error) throw result.error;
      sessions = result.data.map(row => {
        const session = fromRow(row);
        session.registrations = Array.from({ length: Number(row.registration_count) }, (_, index) => ({ id: `occupied-${index}` }));
        return session;
      });
    }
    let siteSettings = { ...defaultSiteSettings };
    const settingsResult = await client.from('site_settings').select('key,value').in('key', ['hero_text', 'hero_subtitle']);
    if (!settingsResult.error) (settingsResult.data || []).forEach(setting => {
      if (setting.key === 'hero_text' && setting.value) siteSettings.heroText = String(setting.value);
      if (setting.key === 'hero_subtitle' && setting.value) siteSettings.heroSubtitle = String(setting.value);
    });
    cache = { sessions, siteSettings, paymentAdjustments, paymentRates, manualPaymentSessions, manualPaymentTemplates, paymentsConfigured, manualPaymentsConfigured, manualPaymentTemplatesConfigured };
    ready = true;
    document.documentElement.classList.remove('appLoading');
    if (typeof window.renderAll === 'function') window.renderAll();
  }

  window.loadData = () => JSON.parse(JSON.stringify(cache));
  window.saveData = async function (next) {
    const before = cache;
    cache = JSON.parse(JSON.stringify(next));
    try {
      await persist(before, cache);
      return true;
    } catch (error) {
      console.error(error); cache = before;
      if (typeof window.showToast === 'function') {
        const errorText = String(error?.message || error?.details || '');
        const multiSportColumnMissing = /has_multisport/i.test(errorText);
        const friendColumnMissing = /booked_by/i.test(errorText);
        const duplicateBooking = error?.code === '23505' || /one_active_phone|duplicate key/i.test(String(error?.message || error?.details || ''));
        window.showToast(friendColumnMissing ? 'Настройката „Запиши приятел“ още не е активирана в базата.' : multiSportColumnMissing ? 'MultiSport настройката още не е активирана в базата.' : duplicateBooking ? 'Този телефон вече е записан за тренировката.' : 'Промяната не беше записана.');
      }
      await refresh().catch(console.error);
      return false;
    }
  };

  async function persist(before, after) {
    if (isAdminPage) {
      const oldIds = new Set(before.sessions.map(item => item.id));
      const newIds = new Set(after.sessions.map(item => item.id));
      const removed = [...oldIds].filter(id => !newIds.has(id));
      if (removed.length) {
        const deleted = await client.from('sessions').delete().in('id', removed);
        if (deleted.error) throw deleted.error;
      }
      const saved = await client.from('sessions').upsert(after.sessions.map(toRow));
      if (saved.error) throw saved.error;
      for (const session of after.sessions) {
        const prior = before.sessions.find(item => item.id === session.id) || { registrations: [] };
        const currentIds = new Set((session.registrations || []).map(item => item.id));
        const removedRegs = (prior.registrations || []).filter(item => !currentIds.has(item.id)).map(item => item.id);
        if (removedRegs.length) {
          const deletedRegs = await client.from('registrations').delete().in('id', removedRegs);
          if (deletedRegs.error) throw deletedRegs.error;
        }
      }
      if ((after.siteSettings?.heroText || defaultSiteSettings.heroText) !== (before.siteSettings?.heroText || defaultSiteSettings.heroText)) {
        const settingSaved = await client.from('site_settings').upsert({ key: 'hero_text', value: after.siteSettings?.heroText || defaultSiteSettings.heroText, updated_at: new Date().toISOString() });
        if (settingSaved.error) throw settingSaved.error;
      }
      if ((after.siteSettings?.heroSubtitle || defaultSiteSettings.heroSubtitle) !== (before.siteSettings?.heroSubtitle || defaultSiteSettings.heroSubtitle)) {
        const subtitleSaved = await client.from('site_settings').upsert({ key: 'hero_subtitle', value: after.siteSettings?.heroSubtitle || defaultSiteSettings.heroSubtitle, updated_at: new Date().toISOString() });
        if (subtitleSaved.error) throw subtitleSaved.error;
      }
      if (after.paymentsConfigured !== false && JSON.stringify(after.paymentAdjustments || {}) !== JSON.stringify(before.paymentAdjustments || {})) {
        const rows = Object.entries(after.paymentAdjustments || {}).map(([sessionId, values]) => ({
          session_id: sessionId,
          extra_individual: Math.max(0, Number(values?.individual) || 0),
          extra_multisport: Math.max(0, Number(values?.multisport) || 0),
          updated_at: new Date().toISOString()
        }));
        if (rows.length) {
          const paymentsSaved = await client.from('payment_adjustments').upsert(rows, { onConflict: 'session_id' });
          if (paymentsSaved.error) throw paymentsSaved.error;
        }
      }
      if (after.paymentsConfigured !== false && JSON.stringify(after.paymentRates || defaultPaymentRates) !== JSON.stringify(before.paymentRates || defaultPaymentRates)) {
        const ratesSaved = await client.from('payment_config').upsert({
          id: 'default',
          multisport_rate: Math.max(0, Number(after.paymentRates?.multisport) || 0),
          individual_rate: Math.max(0, Number(after.paymentRates?.individual) || 0),
          updated_at: new Date().toISOString()
        });
        if (ratesSaved.error) throw ratesSaved.error;
      }
    } else {
      for (const session of after.sessions) {
        const prior = before.sessions.find(item => item.id === session.id) || { registrations: [] };
        const priorIds = new Set((prior.registrations || []).map(item => item.id));
        const added = (session.registrations || []).filter(item => !priorIds.has(item.id) && item.name && item.phone);
        for (const registration of added) {
          const cancelToken = crypto.randomUUID();
          const inserted = await client.from('registrations').insert({
            id: registration.id, session_id: session.id, name: registration.name,
            phone: registration.phone, has_multisport: !!registration.hasMultisport,
            pending: false, cancel_token: cancelToken, booked_by: registration.bookedBy || null
          });
          if (inserted.error) throw inserted.error;
          cancelTokens.set(registration.id, cancelToken);
          if (!registration.friendBooking) {
            const receipts = readReceipts();
            receipts[session.id] = { registrationId: registration.id, token: cancelToken, sessionId: session.id, name: registration.name, createdAt: new Date().toISOString() };
            writeReceipts(receipts);
          }
        }
      }
    }
  }

  async function verifyAdmin() {
    const sessionResult = await client.auth.getSession();
    if (sessionResult.error || !sessionResult.data.session) return { authorized: false, error: sessionResult.error };
    const result = await client.rpc('is_app_admin');
    return { authorized: !result.error && result.data === true, error: result.error, session: sessionResult.data.session };
  }

  window.nikiAdmin = {
    async login(email, password, remember = true) {
      localStorage.setItem(rememberKey, remember ? '1' : '0');
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) return result;
      const access = await verifyAdmin();
      if (!access.authorized) {
        await client.auth.signOut();
        return { error: access.error || new Error('Този профил няма администраторски достъп.') };
      }
      await refresh();
      return result;
    },
    logout: () => client.auth.signOut(),
    async session() {
      const access = await verifyAdmin();
      if (access.authorized) await refresh();
      return access;
    },
    async savePaymentAdjustments(adjustments) {
      const rows = Object.entries(adjustments || {}).map(([sessionId, values]) => ({
        session_id: sessionId,
        extra_individual: Math.max(0, Number(values?.individual) || 0),
        extra_multisport: Math.max(0, Number(values?.multisport) || 0),
        updated_at: new Date().toISOString()
      }));
      if (!rows.length) return { error: null };
      const result = await client.from('payment_adjustments').upsert(rows, { onConflict: 'session_id' });
      if (!result.error) cache.paymentAdjustments = JSON.parse(JSON.stringify(adjustments || {}));
      return result;
    },
    async savePaymentRates(rates) {
      const values = {
        multisport: Math.max(0, Number(rates?.multisport) || 0),
        individual: Math.max(0, Number(rates?.individual) || 0)
      };
      const result = await client.from('payment_config').upsert({
        id: 'default', multisport_rate: values.multisport,
        individual_rate: values.individual, updated_at: new Date().toISOString()
      });
      if (!result.error) cache.paymentRates = values;
      return result;
    },
    async saveManualPaymentSessions(items) {
      const values = (items || []).map(item => ({
        id: String(item.id), date: String(item.date), time: String(item.time || '18:30').slice(0, 5),
        title: String(item.title || 'Step Aerobics with Niki').trim(),
        location: String(item.location || 'Fitness Line').trim(),
        templateId: item.templateId ? String(item.templateId) : '',
        multisportCount: Math.min(1000, Math.max(0, Math.floor(Number(item.multisportCount) || 0))),
        individualCount: Math.min(1000, Math.max(0, Math.floor(Number(item.individualCount) || 0))),
        card8Count: Math.min(1000, Math.max(0, Math.floor(Number(item.card8Count) || 0))),
        card12Count: Math.min(1000, Math.max(0, Math.floor(Number(item.card12Count) || 0))),
        multisportRate: Math.min(999999.99, Math.max(0, Number(item.multisportRate) || 0)),
        individualRate: Math.min(999999.99, Math.max(0, Number(item.individualRate) || 0)),
        card8Rate: item.card8Rate === null || item.card8Rate === undefined ? null : Math.min(999999.99, Math.max(0, Number(item.card8Rate) || 0)),
        card12Rate: item.card12Rate === null || item.card12Rate === undefined ? null : Math.min(999999.99, Math.max(0, Number(item.card12Rate) || 0))
      }));
      const nextIds = new Set(values.map(item => item.id));
      const removedIds = (cache.manualPaymentSessions || []).filter(item => !nextIds.has(String(item.id))).map(item => item.id);
      if (values.length) {
        const saved = await client.from('manual_payment_sessions').upsert(values.map(toManualPaymentRow), { onConflict: 'id' });
        if (saved.error) return saved;
      }
      if (removedIds.length) {
        const removed = await client.from('manual_payment_sessions').delete().in('id', removedIds);
        if (removed.error) return removed;
      }
      cache.manualPaymentSessions = JSON.parse(JSON.stringify(values));
      return { error: null };
    },
    async saveManualPaymentTemplates(items) {
      const values = (items || []).map((item, index) => ({
        id: String(item.id), name: String(item.name || '').trim(), title: String(item.title || '').trim(), location: String(item.location || '').trim(),
        time: String(item.time || '18:30').slice(0, 5), multisportRate: Math.max(0, Number(item.multisportRate) || 0), individualRate: Math.max(0, Number(item.individualRate) || 0),
        card8Rate: item.card8Rate === null ? null : Math.max(0, Number(item.card8Rate) || 0), card12Rate: item.card12Rate === null ? null : Math.max(0, Number(item.card12Rate) || 0), sortOrder: Number(item.sortOrder) || index + 1
      }));
      const result = await client.from('manual_payment_templates').upsert(values.map(toManualPaymentTemplateRow), { onConflict: 'id' });
      if (!result.error) cache.manualPaymentTemplates = JSON.parse(JSON.stringify(values));
      return result;
    },
    refresh
  };

  window.nikiBookings = {
    has(sessionId) { return !!readReceipts()[sessionId]; },
    get(sessionId) { return readReceipts()[sessionId] || null; },
    async cancel(sessionId) {
      const receipts = readReceipts();
      const receipt = receipts[sessionId];
      if (!receipt) return { ok: false, message: 'На този телефон не е намерено записване за тренировката.' };
      const result = await client.rpc('cancel_registration', { registration_id: receipt.registrationId, token: receipt.token });
      if (result.error) return { ok: false, message: 'Отписването не беше извършено. Опитай отново.' };
      if (!result.data) { delete receipts[sessionId]; writeReceipts(receipts); return { ok: false, message: 'Записването вече е отменено или не съществува.' }; }
      delete receipts[sessionId];
      writeReceipts(receipts);
      await refresh();
      return { ok: true };
    }
  };

  window.undoBooking = async function () {
    if (!window.pendingBooking) return;
    const token = cancelTokens.get(window.pendingBooking.regId);
    if (token) {
      const result = await client.rpc('cancel_registration', { registration_id: window.pendingBooking.regId, token });
      if (result.error || !result.data) return window.showToast?.('Записването не може да бъде отказано.');
      cancelTokens.delete(window.pendingBooking.regId);
    }
    window.pendingBooking = null;
    if (window.undoTimer) { clearInterval(window.undoTimer); window.undoTimer = null; }
    document.getElementById('undoModal')?.classList.remove('open');
    await refresh();
    window.showToast?.('Записването е отказано.');
  };

  const liveChannel = client.channel('niki-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, refresh);
  if (isAdminPage) liveChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'payment_adjustments' }, refresh);
  if (isAdminPage) liveChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'payment_config' }, refresh);
  liveChannel.subscribe();

  document.addEventListener('DOMContentLoaded', () => {
    const footer = document.createElement('footer');
    footer.style.cssText = 'padding:24px 12px 28px;text-align:center;font:800 11px/1.4 system-ui;color:#8a9098;letter-spacing:.06em';
    footer.innerHTML = '<a href="https://trainwithniki.github.io/NikiStep/admin" style="color:inherit;text-decoration:none"><strong>Powered by Niki Ilieva</strong></a>';
    document.body.appendChild(footer);
  });

  if (!isAdminPage) refresh().catch(error => {
    console.error(error);
    document.documentElement.classList.remove('appLoading');
    if (!ready && typeof window.showToast === 'function') window.showToast('Няма връзка с базата данни.');
  });
})();
