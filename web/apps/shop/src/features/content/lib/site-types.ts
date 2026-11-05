import type { components } from "@polivalko/shared/api/schema";

type S = components["schemas"];

export type SiteHome = S["SiteHomeDto"];
export type Banner = S["HomeBannerDto"];
export type Announcement = S["HomeAnnouncementDto"];
export type TextItem = S["HomeItemDto"];
export type SpecialDay = S["SpecialDayDto"];
