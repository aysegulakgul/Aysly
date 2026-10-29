/** Yerel tarih + saati saat diliminde ana çeviren işlev (tasks modülündeki BR-DATE-006 uygulaması enjekte edilir). */
export type ZonedTimeToUtc = (date: string, time: string, timeZone: string) => Date;
