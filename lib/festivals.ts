// Major Indian festivals (approximate 2026 dates — lunar festivals shift yearly).
// Used by the Relationship Radar to surface effortless greeting moments.
export type Festival = { name: string; date: string; emoji: string; greeting: string };

export const FESTIVALS_2026: Festival[] = [
  { name: "Makar Sankranti / Pongal", date: "2026-01-14", emoji: "🪁", greeting: "Happy Pongal" },
  { name: "Republic Day", date: "2026-01-26", emoji: "🇮🇳", greeting: "Happy Republic Day" },
  { name: "Maha Shivaratri", date: "2026-02-15", emoji: "🕉️", greeting: "Har Har Mahadev" },
  { name: "Holi", date: "2026-03-04", emoji: "🎨", greeting: "Happy Holi" },
  { name: "Ugadi", date: "2026-03-19", emoji: "🌼", greeting: "Ugadi Subhakankshalu" },
  { name: "Ram Navami", date: "2026-03-26", emoji: "🙏", greeting: "Happy Ram Navami" },
  { name: "Eid al-Fitr", date: "2026-03-20", emoji: "🌙", greeting: "Eid Mubarak" },
  { name: "Akshaya Tritiya", date: "2026-04-20", emoji: "✨", greeting: "Happy Akshaya Tritiya" },
  { name: "Eid al-Adha (Bakrid)", date: "2026-05-27", emoji: "🌙", greeting: "Eid Mubarak" },
  { name: "Muharram", date: "2026-06-26", emoji: "🌙", greeting: "Warm wishes on Muharram" },
  { name: "Guru Purnima", date: "2026-07-29", emoji: "🪔", greeting: "Happy Guru Purnima" },
  { name: "Independence Day", date: "2026-08-15", emoji: "🇮🇳", greeting: "Happy Independence Day" },
  { name: "Raksha Bandhan", date: "2026-08-28", emoji: "🧵", greeting: "Happy Raksha Bandhan" },
  { name: "Janmashtami", date: "2026-09-04", emoji: "🦚", greeting: "Happy Janmashtami" },
  { name: "Ganesh Chaturthi", date: "2026-09-14", emoji: "🐘", greeting: "Ganpati Bappa Morya" },
  { name: "Dussehra", date: "2026-10-20", emoji: "🏹", greeting: "Happy Dussehra" },
  { name: "Diwali", date: "2026-11-08", emoji: "🪔", greeting: "Happy Diwali" },
  { name: "Christmas", date: "2026-12-25", emoji: "🎄", greeting: "Merry Christmas" },
];

/** Festivals falling within the next `days` days from `from`. */
export function upcomingFestivals(from: Date, days = 60): Festival[] {
  const end = new Date(from);
  end.setDate(end.getDate() + days);
  return FESTIVALS_2026.filter((f) => {
    const d = new Date(f.date + "T00:00:00");
    return d >= from && d <= end;
  });
}
