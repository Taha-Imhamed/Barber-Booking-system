import { createContext, useContext, useMemo, useState } from "react";

type Lang = "en" | "tr" | "sq";
type Dictionary = Record<string, { en: string; tr: string; sq: string }>;

const dictionary: Dictionary = {
  language: { en: "Language", tr: "Dil", sq: "Gjuha" },
  english: { en: "English", tr: "Ingilizce", sq: "Anglisht" },
  turkish: { en: "Turkish", tr: "Turkce", sq: "Turqisht" },
  albanian: { en: "Albanian", tr: "Arnavutca", sq: "Shqip" },
  signIn: { en: "Sign In", tr: "Giris Yap", sq: "Hyr" },
  signOut: { en: "Logout", tr: "Cikis Yap", sq: "Dil" },
  timetable: { en: "Timetable", tr: "Zaman Cizelgesi", sq: "Orari" },
  wallDisplay: { en: "Wall Display", tr: "Ekran", sq: "Ekrani i murit" },
  backHome: { en: "Back to home", tr: "Ana sayfaya don", sq: "Kthehu ne kryefaqe" },
  googleSignIn: { en: "Continue with Google", tr: "Google ile devam et", sq: "Vazhdo me Google" },
  verifyEmailNote: {
    en: "New accounts must verify email before login.",
    tr: "Yeni hesaplar giris oncesi e-posta dogrulamali.",
    sq: "Llogarite e reja duhet te verifikojne email-in para hyrjes.",
  },
  team: { en: "Our Team", tr: "Ekibimiz", sq: "Ekipi yne" },
  reserveWith: { en: "Reserve with", tr: "Su berberle randevu al", sq: "Rezervo me" },
  confirmReserve: { en: "Start reservation with this barber?", tr: "Bu berberle rezervasyon baslatilsin mi?", sq: "Ta fillojme rezervimin me kete berber?" },
  yes: { en: "Yes", tr: "Evet", sq: "Po" },
  no: { en: "No", tr: "Hayir", sq: "Jo" },
  bookYourAppointment: { en: "Book Your Appointment", tr: "Randevunuzu Alin", sq: "Rezervoni Terminin Tuaj" },
  stepOf3: { en: "Step", tr: "Adim", sq: "Hapi" },
  of: { en: "of", tr: "/", sq: "nga" },
  branch: { en: "Branch", tr: "Sube", sq: "Dega" },
  service: { en: "Service", tr: "Hizmet", sq: "Sherbimi" },
  barber: { en: "Barber", tr: "Berber", sq: "Berberi" },
  date: { en: "Date", tr: "Tarih", sq: "Data" },
  time: { en: "Time", tr: "Saat", sq: "Ora" },
  loading: { en: "Loading...", tr: "Yukleniyor...", sq: "Duke u ngarkuar..." },
  selectBranch: { en: "Select branch", tr: "Sube secin", sq: "Zgjidh degen" },
  selectService: { en: "Select service", tr: "Hizmet secin", sq: "Zgjidh sherbimin" },
  selectBarber: { en: "Select barber", tr: "Berber secin", sq: "Zgjidh berberin" },
  selectTime: { en: "Select time", tr: "Saat secin", sq: "Zgjidh oren" },
  pickDate: { en: "Pick a date", tr: "Tarih secin", sq: "Zgjidh nje date" },
  continue: { en: "Continue", tr: "Devam", sq: "Vazhdo" },
  back: { en: "Back", tr: "Geri", sq: "Kthehu" },
  submitReservation: { en: "Submit Reservation", tr: "Rezervasyon Gonder", sq: "Dergo Rezervimin" },
  submitting: { en: "Submitting...", tr: "Gonderiliyor...", sq: "Duke derguar..." },
  checkByNumber: { en: "Check Reservation by Number", tr: "Numarayla Rezervasyon Sorgula", sq: "Kontrollo Rezervimin me Numer" },
  firstName: { en: "First Name", tr: "Ad", sq: "Emri" },
  lastName: { en: "Last Name", tr: "Soyad", sq: "Mbiemri" },
  phoneNumber: { en: "Phone Number", tr: "Telefon Numarasi", sq: "Numri i telefonit" },
  emailOptional: { en: "Email (Optional)", tr: "E-posta (Istege bagli)", sq: "Email (Opsionale)" },
  expShort: { en: "y exp", tr: "yil tecrube", sq: "vite eksperience" },
  barberUnavailableAt: { en: "This barber is not available at", tr: "Bu berber su saatte musait degil", sq: "Ky berber nuk eshte i lire ne oren" },
  barberLockedMinutes: { en: "Barber is locked for at least", tr: "Berber en az su kadar sure kilitli", sq: "Berberi bllokohet per te pakten" },
  minutesPerBooking: { en: "minutes per booking.", tr: "dakika rezervasyon basina.", sq: "minuta per rezervim." },
  priorityEnabled: { en: "Priority booking enabled for your account.", tr: "Hesabiniz icin oncelikli rezervasyon aktif.", sq: "Rezervimi me perparesi eshte aktiv per llogarine tuaj." },
  loyaltyEarn: { en: "You earn loyalty points for completed visits and can redeem discounts later.", tr: "Tamamlanan ziyaretlerden puan kazanir, sonra indirimde kullanirsiniz.", sq: "Fitoni pike besnikerie per vizitat e perfunduara dhe i perdorni me vone per zbritje." },
  reservationSubmitted: { en: "Reservation submitted", tr: "Rezervasyon gonderildi", sq: "Rezervimi u dergua" },
  reservationSubmittedDesc: { en: "Your request was sent to the barber. You will get notified on updates.", tr: "Talebiniz berbere iletildi. Guncellemelerden haberdar edilirsiniz.", sq: "Kerkesa juaj iu dergua berberit. Do njoftoheni per perditesimet." },
  reservationFailed: { en: "Could not submit reservation", tr: "Rezervasyon gonderilemedi", sq: "Rezervimi nuk u dergua" },
  tryAgain: { en: "Try again.", tr: "Tekrar deneyin.", sq: "Provoni perseri." },
  selectRequiredFields: { en: "Please choose branch, service, barber, and time.", tr: "Lutfen sube, hizmet, berber ve saat secin.", sq: "Ju lutem zgjidhni degen, sherbimin, berberin dhe oren." },
  invalidSession: { en: "Invalid account session. Please sign in again.", tr: "Gecersiz hesap oturumu. Lutfen tekrar giris yapin.", sq: "Sesion i pavlefshem i llogarise. Ju lutem hyni perseri." },
  barberWrongBranch: { en: "Selected barber does not belong to selected branch.", tr: "Secilen berber secilen subeye ait degil.", sq: "Berberi i zgjedhur nuk i perket deges se zgjedhur." },
  priorityBadge: { en: "Priority booking available for signed-in clients", tr: "Giris yapan musteriler icin oncelikli rezervasyon", sq: "Rezervim me perparesi per klientet e kycur" },
  heroLine1: { en: "Istanbul Salon.", tr: "Istanbul Salon.", sq: "Istanbul Salon." },
  heroLine2: { en: "Reserve fast.", tr: "Hizli rezervasyon.", sq: "Rezervo shpejt." },
  heroLine3: { en: "Arrive ready.", tr: "Hazir gelin.", sq: "Eja gati." },
  heroDesc: { en: "Pick branch, barber, service, date, and time in under a minute. Sign up as client to save history and loyalty points.", tr: "Bir dakikadan kisa surede sube, berber, hizmet, tarih ve saat secin. Gecmis ve puanlar icin kayit olun.", sq: "Zgjidhni degen, berberin, sherbimin, daten dhe oren ne me pak se nje minute. Regjistrohuni si klient per historik dhe pike." },
  realtimeApproval: { en: "Real-time approval", tr: "Anlik onay", sq: "Miratim ne kohe reale" },
  realtimeApprovalDesc: { en: "Barbers accept, reject, or postpone requests.", tr: "Berberler talepleri kabul eder, reddeder veya erteler.", sq: "Berberet i pranojne, refuzojne ose shtyjne kerkesat." },
  prioritySystem: { en: "Priority system", tr: "Oncelik sistemi", sq: "Sistem perparesie" },
  prioritySystemDesc: { en: "Registered users are prioritized.", tr: "Kayitli kullanicilar oncelik alir.", sq: "Perdoruesit e regjistruar kane perparesi." },
  loyaltyRewards: { en: "Loyalty rewards", tr: "Sadakat odulleri", sq: "Shperblime besnikerie" },
  loyaltyRewardsDesc: { en: "Earn points and unlock discounts.", tr: "Puan kazanin ve indirim acin.", sq: "Fitoni pike dhe zhbllokoni zbritje." },
  teamTapPhoto: { en: "Tap a barber photo to start booking with them.", tr: "Onlarla rezervasyon baslatmak icin berber fotosuna dokunun.", sq: "Prekni foton e berberit per te nisur rezervimin me te." },
  authSignInTitle: { en: "Istanbul Salon Sign In", tr: "Istanbul Salon Giris", sq: "Hyrje Istanbul Salon" },
  authCreateAccount: { en: "Create Account", tr: "Hesap Olustur", sq: "Krijo Llogari" },
  authManageReservations: { en: "Manage your reservations and points", tr: "Rezervasyonlarinizi ve puanlarinizi yonetin", sq: "Menaxhoni rezervimet dhe piket tuaja" },
  authGetPriority: { en: "Get priority booking and loyalty rewards", tr: "Oncelikli rezervasyon ve sadakat odulleri alin", sq: "Merrni rezervim me perparesi dhe shperblime besnikerie" },
  phone: { en: "Phone", tr: "Telefon", sq: "Telefoni" },
  email: { en: "Email", tr: "E-posta", sq: "Email" },
  username: { en: "Username", tr: "Kullanici adi", sq: "Emri i perdoruesit" },
  password: { en: "Password", tr: "Sifre", sq: "Fjalekalimi" },
  hidePassword: { en: "Hide password", tr: "Sifreyi gizle", sq: "Fshihe fjalekalimin" },
  showPassword: { en: "Show password", tr: "Sifreyi goster", sq: "Shfaq fjalekalimin" },
  rememberUsername: { en: "Remember username on this device", tr: "Bu cihazda kullanici adini hatirla", sq: "Mba mend emrin e perdoruesit ne kete pajisje" },
  processing: { en: "Processing...", tr: "Isleniyor...", sq: "Duke procesuar..." },
  clientsOnly: { en: "(Clients only)", tr: "(Sadece musteriler)", sq: "(Vetem kliente)" },
  sending: { en: "Sending...", tr: "Gonderiliyor...", sq: "Duke derguar..." },
  resendVerification: { en: "Resend verification email", tr: "Dogrulama e-postasini yeniden gonder", sq: "Ridrejgo email-in e verifikimit" },
  needAccount: { en: "Need an account? Register", tr: "Hesabin yok mu? Kaydol", sq: "Nuk keni llogari? Regjistrohu" },
  haveAccount: { en: "Already have an account? Sign in", tr: "Zaten hesabin var mi? Giris yap", sq: "Keni tashme llogari? Hyni" },
  usernamePasswordRequired: { en: "Username and password are required.", tr: "Kullanici adi ve sifre zorunludur.", sq: "Emri i perdoruesit dhe fjalekalimi jane te detyrueshem." },
  passwordMin6: { en: "Password must be at least 6 characters.", tr: "Sifre en az 6 karakter olmali.", sq: "Fjalekalimi duhet te kete te pakten 6 karaktere." },
  welcomeBack: { en: "Welcome back", tr: "Tekrar hos geldiniz", sq: "Mire se u ktheve" },
  accountCreated: { en: "Account created", tr: "Hesap olusturuldu", sq: "Llogaria u krijua" },
  accountCreatedDesc: { en: "Priority + loyalty enabled for your account.", tr: "Hesabiniz icin oncelik + sadakat aktif edildi.", sq: "Perparesia + besnikeria u aktivizuan per llogarine tuaj." },
  authFailed: { en: "Authentication failed", tr: "Kimlik dogrulama basarisiz", sq: "Autentikimi deshtoi" },
  emailRequired: { en: "Email required", tr: "E-posta gerekli", sq: "Email-i kerkohet" },
  enterEmailFirst: { en: "Enter your email first.", tr: "Once e-postanizi girin.", sq: "Fillimisht shkruani email-in tuaj." },
  verification: { en: "Verification", tr: "Dogrulama", sq: "Verifikim" },
  error: { en: "Error", tr: "Hata", sq: "Gabim" },
  verificationFailed: { en: "Verification failed", tr: "Dogrulama basarisiz", sq: "Verifikimi deshtoi" },
  invalidLink: { en: "Invalid link.", tr: "Gecersiz baglanti.", sq: "Lidhje e pavlefshme." },
  emailVerified: { en: "Email verified", tr: "E-posta dogrulandi", sq: "Email-i u verifikua" },
  signInClientsOnly: { en: "Clients only", tr: "Sadece musteriler", sq: "Vetem kliente" },
  checkByPhoneTitle: { en: "Check Appointment by Phone", tr: "Telefonla Randevu Sorgula", sq: "Kontrollo Terminin me Telefon" },
  enterPhone: { en: "Enter your phone number", tr: "Telefon numaranizi girin", sq: "Shkruani numrin tuaj te telefonit" },
  check: { en: "Check", tr: "Sorgula", sq: "Kontrollo" },
  login: { en: "Login", tr: "Giris", sq: "Hyrje" },
  backToBooking: { en: "Back To Booking", tr: "Rezervasyona Don", sq: "Kthehu te Rezervimi" },
  openedMessage: { en: "Opened Message", tr: "Acilan Mesaj", sq: "Mesazhi i hapur" },
  notifications: { en: "Notifications", tr: "Bildirimler", sq: "Njoftime" },
  noNotifications: { en: "No notifications.", tr: "Bildirim yok.", sq: "Nuk ka njoftime." },
  openMessage: { en: "Open Message", tr: "Mesaji Ac", sq: "Hap mesazhin" },
  readMessage: { en: "Read Message", tr: "Mesaji Oku", sq: "Lexo mesazhin" },
  appointments: { en: "Appointments", tr: "Randevular", sq: "Terminet" },
  noAppointmentsForPhone: { en: "No appointments found for this phone.", tr: "Bu telefon icin randevu bulunamadi.", sq: "Nuk u gjeten termine per kete numer." },
  status: { en: "Status", tr: "Durum", sq: "Statusi" },
  newProposedTime: { en: "New proposed time", tr: "Yeni onerilen saat", sq: "Koha e re e propozuar" },
  accept: { en: "Accept", tr: "Kabul Et", sq: "Prano" },
  anotherTime: { en: "Another Time", tr: "Baska Saat", sq: "Nje kohe tjeter" },
  newTimeAccepted: { en: "New time accepted", tr: "Yeni saat kabul edildi", sq: "Koha e re u pranua" },
  askedAnotherTime: { en: "You asked for another time", tr: "Baska bir saat istediniz", sq: "Kerkove nje kohe tjeter" },
  addTipOptional: { en: "Add tip (optional)", tr: "Bahsis ekle (istege bagli)", sq: "Shto bakshish (opsionale)" },
  tipAmount: { en: "Tip amount", tr: "Bahsis miktari", sq: "Shuma e bakshishit" },
  markCompleted: { en: "Mark Completed", tr: "Tamamlandi Olarak Isaretle", sq: "Shenoje si te perfunduar" },
  completeWithTip: { en: "Complete + Tip", tr: "Tamamla + Bahsis", sq: "Perfundo + Bakshish" },
};

const I18nContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dictionary) => string;
}>({
  lang: "en",
  setLang: () => {},
  t: (key) => dictionary[key].en,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "tr" || stored === "sq") return stored;
    return "en";
  });

  const value = useMemo(
    () => ({
      lang,
      setLang: (next: Lang) => {
        localStorage.setItem("lang", next);
        setLang(next);
      },
      t: (key: keyof typeof dictionary) => dictionary[key][lang],
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
