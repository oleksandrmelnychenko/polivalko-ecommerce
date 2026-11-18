import Link from "next/link";
import { connection } from "next/server";
import { getAnnouncement } from "@/features/content/server";

export async function AnnouncementBar() {
  await connection();
  const announcement = await getAnnouncement().catch(() => null);
  if (!announcement) return null;
  const link = announcement.link?.trim();
  return (
    <aside className="announce" aria-label="Оголошення">
      <div className="container announce__inner">
        {link ? (
          <Link href={link} className="announce__text">
            {announcement.text}
          </Link>
        ) : (
          <p className="announce__text">{announcement.text}</p>
        )}
      </div>
    </aside>
  );
}
