// Robust Jalali Conversion Algorithms (Based on jalaali-js implementation)

export const jalaliMonthNames = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

export const lunarMonthNames = [
  "محرم", "صفر", "ربیع‌الاول", "ربیع‌الثانی", "جمادی‌الاول", "جمادی‌الثانی",
  "رجب", "شعبان", "رمضان", "شوال", "ذیقعده", "ذیحجه"
];

// Fixed Solar Holidays
const SOLAR_HOLIDAYS: Record<string, string> = {
    '1-1': 'عید نوروز',
    '1-2': 'عید نوروز',
    '1-3': 'عید نوروز',
    '1-4': 'عید نوروز',
    '1-12': 'روز جمهوری اسلامی',
    '1-13': 'روز طبیعت',
    '3-14': 'رحلت امام خمینی',
    '3-15': 'قیام ۱۵ خرداد',
    '11-22': 'پیروزی انقلاب اسلامی',
    '12-29': 'روز ملی شدن صنعت نفت',
};

// Fixed Lunar Holidays (Key: 'Month-Day')
const LUNAR_HOLIDAYS: Record<string, string> = {
    '1-9': 'تاسوعای حسینی',
    '1-10': 'عاشورای حسینی',
    '2-20': 'اربعین حسینی',
    '2-28': 'رحلت پیامبر (ص) و شهادت امام حسن (ع)',
    '2-30': 'شهادت امام رضا (ع)', 
    '8-15': 'نیمه شعبان (ولادت امام زمان)',
    '9-21': 'شهادت حضرت علی (ع)',
    '10-1': 'عید سعید فطر',
    '10-25': 'شهادت امام جعفر صادق (ع)',
    '12-10': 'عید سعید قربان',
    '12-18': 'عید سعید غدیر خم',
};

// --- Core Algorithms ---

function div(a: number, b: number) {
  return ~~(a / b);
}

function gregorianToJalaliCore(gy: number, gm: number, gd: number) {
  let g_d_m, jy, jm, jd, gy2, days;
  g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  gy2 = (gm > 2) ? (gy + 1) : gy;
  days = 355666 + (365 * gy) + div((gy2 + 3), 4) - div((gy2 + 99), 100) + div((gy2 + 399), 400) + gd + g_d_m[gm - 1];
  jy = -1595 + (33 * div(days, 12053));
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div((days - 1), 365);
    days = (days - 1) % 365;
  }
  if (days < 186) {
    jm = 1 + div(days, 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + div((days - 186), 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

function jalaliToGregorianCore(jy: number, jm: number, jd: number) {
  let gy, gm, gd, days, sal_a, v;
  jy += 1595;
  days = -355668 + (365 * jy) + (div(jy, 33) * 8) + div(((jy % 33) + 3), 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    days--;
    gy += 100 * div(days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div((days - 1), 365);
    days = (days - 1) % 365;
  }
  gd = days + 1;
  sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (gm = 0; gm < 13; gm++) {
    v = sal_a[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return [gy, gm, gd];
}

// Lunar Hijri Calculation
// Synced for: 1 Bahman 1404 = 1 Shaban 1447
function gregorianToHijri(gy: number, gm: number, gd: number) {
    let day = gd;
    let month = gm;
    let year = gy;
    
    // Offset Adjustment
    // -2 day offset aligns 21 Jan 2026 to 1 Shaban as requested
    const CALIBRATION_OFFSET = -2;

    let m = month;
    let y = year;
    if (m < 3) {
        y -= 1;
        m += 12;
    }

    let a = Math.floor(y / 100);
    let b = 2 - a + Math.floor(a / 4);
    if (y < 1583) b = 0;
    if (y === 1582) {
        if (m > 10) b = -10;
        if (m === 10) {
            b = 0;
            if (day > 4) b = -10;
        }
    }

    let jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;
    
    // Apply Calibration
    jd += CALIBRATION_OFFSET;

    b = 0;
    if (jd > 2299160) {
        a = Math.floor((jd - 1867216.25) / 36524.25);
        b = 1 + a - Math.floor(a / 4);
    }
    let bb = jd + b + 1524;
    let cc = Math.floor((bb - 122.1) / 365.25);
    let dd = Math.floor(365.25 * cc);
    let ee = Math.floor((bb - dd) / 30.6001);
    day = (bb - dd) - Math.floor(30.6001 * ee);
    month = ee - 1;
    if (ee > 13) {
        cc += 1;
        month = ee - 13;
    }
    year = cc - 4716;

    let iyear = 10631.0 / 30.0;
    let epochastro = 1948084;
    let shift1 = 8.01 / 60.0;
    let z = jd - epochastro;
    let cyc = Math.floor(z / 10631.0);
    z = z - 10631 * cyc;
    let j = Math.floor((z - shift1) / iyear);
    let iy = 30 * cyc + j;
    z = z - Math.floor(j * iyear + shift1);
    let im = Math.floor((z + 28.5001) / 29.5);
    if (im === 13) im = 12;
    // Ensure 1-based month for safety with array indexing later
    if (im === 0) im = 1;
    
    let id = z - Math.floor(29.5 * im - 29);
    return [iy, im, id];
}

// --- Exports ---

export const gregorianToJalali = (gy: number, gm: number, gd: number) => {
  return gregorianToJalaliCore(gy, gm, gd);
};

export const jalaliToGregorian = (jy: number, jm: number, jd: number) => {
    return jalaliToGregorianCore(jy, jm, jd);
};

export const getLunarDate = (jy: number, jm: number, jd: number) => {
    const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
    return gregorianToHijri(gy, gm, gd);
};

export const formatJalali = (isoDate: string): string => {
  const d = new Date(isoDate);
  const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${jd} ${jalaliMonthNames[jm - 1]} ${jy}`;
};

export const getJalaliDaysInMonth = (jy: number, jm: number): number => {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const isLeap = ((((jy + 38) * 31) % 128) <= 30);
  return isLeap ? 30 : 29;
}

export const isHoliday = (jy: number, jm: number, jd: number, dayOfWeek: number): boolean => {
    if (dayOfWeek === 6) return true;
    
    // Solar Check
    const solarKey = `${jm}-${jd}`;
    if (SOLAR_HOLIDAYS[solarKey]) return true;

    // Lunar Check
    const [ly, lm, ld] = getLunarDate(jy, jm, jd);
    const lunarKey = `${lm}-${ld}`;
    if (LUNAR_HOLIDAYS[lunarKey]) return true;

    return false;
};

export const getHolidayName = (jy: number, jm: number, jd: number, dayOfWeek: number): string | null => {
    // Solar
    const solarKey = `${jm}-${jd}`;
    if (SOLAR_HOLIDAYS[solarKey]) return SOLAR_HOLIDAYS[solarKey];

    // Lunar
    const [ly, lm, ld] = getLunarDate(jy, jm, jd);
    const lunarKey = `${lm}-${ld}`;
    if (LUNAR_HOLIDAYS[lunarKey]) return LUNAR_HOLIDAYS[lunarKey];

    if (dayOfWeek === 6) return 'جمعه';
    return null;
};

// Returns 0 for Saturday, 1 for Sunday, ..., 6 for Friday
export const getDayOfWeekJalali = (jy: number, jm: number, jd: number): number => {
    const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
    const date = new Date(gy, gm - 1, gd);
    const day = date.getDay(); // 0=Sun
    const map = [1, 2, 3, 4, 5, 6, 0];
    return map[day];
}