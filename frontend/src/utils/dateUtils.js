import { format, differenceInDays, addDays, isAfter, isBefore, startOfDay } from 'date-fns';
export const formatCheckDate = (date) => format(new Date(date), 'dd MMM yyyy');
export const formatInputDate = (date) => format(new Date(date), 'yyyy-MM-dd');
export const getNights = (checkIn, checkOut) => differenceInDays(new Date(checkOut), new Date(checkIn));
export const getMinCheckout = (checkIn) => addDays(new Date(checkIn), 1);
export const isDateInRange = (date, start, end) => !isBefore(date, start) && !isAfter(date, end);
export const getToday = () => formatInputDate(startOfDay(new Date()));
export const getTomorrow = () => formatInputDate(addDays(startOfDay(new Date()), 1));
