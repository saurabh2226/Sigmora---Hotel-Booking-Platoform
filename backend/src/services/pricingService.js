const FIXED_HOLIDAYS = {
  '01-01': 'New Year',
  '01-14': 'Makar Sankranti',
  '01-26': 'Republic Day',
  '05-01': 'Labour Day',
  '08-15': 'Independence Day',
  '10-02': 'Gandhi Jayanti',
  '12-25': 'Christmas',
};

const MOVABLE_HOLIDAYS = {
  2026: {
    '02-15': 'Maha Shivratri',
    '03-04': 'Holi',
    '03-21': 'Eid al-Fitr',
    '11-08': 'Diwali',
  },
  2027: {
    '03-22': 'Holi',
    '04-10': 'Eid al-Fitr',
    '10-29': 'Diwali',
  },
  2028: {
    '03-10': 'Holi',
    '03-30': 'Eid al-Fitr',
    '10-17': 'Diwali',
  },
};

const WEEKEND_SURCHARGE = 0.18;
const HOLIDAY_SURCHARGE = 0.28;

const roundCurrency = (value) => Math.round(value * 100) / 100;

const normalizeDate = (value) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const formatDateKey = (value) => {
  const date = normalizeDate(value);
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${month}-${day}`;
};

const enumerateStayDates = (checkIn, checkOut) => {
  const dates = [];
  const cursor = normalizeDate(checkIn);
  const end = normalizeDate(checkOut);

  while (cursor < end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

const getHolidayName = (dateValue) => {
  const date = normalizeDate(dateValue);
  const dateKey = formatDateKey(date);
  const yearHolidays = MOVABLE_HOLIDAYS[date.getUTCFullYear()] || {};

  return yearHolidays[dateKey] || FIXED_HOLIDAYS[dateKey] || null;
};

const getNightPricing = (baseRate, dateValue) => {
  const date = normalizeDate(dateValue);
  const tags = [];
  let multiplier = 1;

  if ([5, 6].includes(date.getUTCDay())) {
    multiplier += WEEKEND_SURCHARGE;
    tags.push('weekend');
  }

  const holidayName = getHolidayName(date);
  if (holidayName) {
    multiplier += HOLIDAY_SURCHARGE;
    tags.push(`holiday:${holidayName}`);
  }

  return {
    date,
    tags,
    holidayName,
    adjustedRate: roundCurrency(baseRate * multiplier),
  };
};

const calculateDynamicPricing = ({ baseRate, checkIn, checkOut, coupon = null }) => {
  const nights = enumerateStayDates(checkIn, checkOut);
  const nightlyBreakdown = nights.map((night) => {
    const pricing = getNightPricing(baseRate, night);
    return {
      date: pricing.date,
      baseRate: roundCurrency(baseRate),
      adjustedRate: pricing.adjustedRate,
      tags: pricing.tags,
      holidayName: pricing.holidayName,
    };
  });

  const subtotal = roundCurrency(
    nightlyBreakdown.reduce((sum, night) => sum + night.adjustedRate, 0)
  );
  const taxes = roundCurrency(subtotal * 0.18);
  const serviceFee = roundCurrency(subtotal * 0.05);
  const discount = coupon ? coupon.calculateDiscount(subtotal) : 0;
  const totalPrice = roundCurrency(subtotal + taxes + serviceFee - discount);
  const numberOfNights = nightlyBreakdown.length;
  const averageNightlyRate = numberOfNights ? roundCurrency(subtotal / numberOfNights) : roundCurrency(baseRate);
  const highestNightlyRate = nightlyBreakdown.length
    ? Math.max(...nightlyBreakdown.map((night) => night.adjustedRate))
    : roundCurrency(baseRate);

  return {
    nightlyRate: averageNightlyRate,
    baseNightlyRate: roundCurrency(baseRate),
    highestNightlyRate,
    numberOfNights,
    subtotal,
    taxes,
    serviceFee,
    discount,
    totalPrice,
    weekendNights: nightlyBreakdown.filter((night) => night.tags.includes('weekend')).length,
    holidayNights: nightlyBreakdown.filter((night) => night.holidayName).length,
    nightlyBreakdown,
  };
};

module.exports = {
  WEEKEND_SURCHARGE,
  HOLIDAY_SURCHARGE,
  roundCurrency,
  normalizeDate,
  enumerateStayDates,
  getHolidayName,
  getNightPricing,
  calculateDynamicPricing,
};
