import { ReservationForm } from "@/components/ReservationForm";
import { Navbar } from "@/components/layout/Navbar";
import { useBarbers } from "@/hooks/use-barbers";
import { CalendarClock, ShieldCheck, Gift } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { useBarberGallery, useLandingMedia } from "@/hooks/use-advanced";
import { normalizeInstagramUrl } from "@/lib/instagram";

const HERO_BG =
  "https://static.vecteezy.com/ti/photos-gratuite/t2/65578350-cette-bien-equipe-salon-de-coiffure-caracteristiques-une-tondeuse-en-train-de-preparer-pour-barbe-toilettage-seances-photo.jpg";

export default function Landing() {
  const { data: barbers } = useBarbers();
  const { t } = useI18n();
  const [selectedBarberId, setSelectedBarberId] = useState<number | null>(null);
  const [confirmBarberId, setConfirmBarberId] = useState<number | null>(null);
  const [galleryBarberId, setGalleryBarberId] = useState<number | null>(null);
  const [zoomedMedia, setZoomedMedia] = useState<{ src: string; title: string; type: "image" | "video" } | null>(null);
  const gallery = useBarberGallery(confirmBarberId ?? undefined);
  const clientGallery = useBarberGallery(galleryBarberId ?? undefined);
  const landingMedia = useLandingMedia();
  const landingPhotoItems = useMemo(
    () =>
      (landingMedia.data?.photos ?? [])
        .map((p: any) => ({
          id: String(p?.id ?? ""),
          title: String(p?.title ?? ""),
          imageUrl: String(p?.imageUrl ?? p?.image_url ?? p?.url ?? ""),
        }))
        .filter((p: any) => p.imageUrl.trim().length > 0),
    [landingMedia.data?.photos],
  );
  const landingVideoItems = useMemo(
    () =>
      (landingMedia.data?.videos ?? [])
        .map((v: any) => ({
          id: String(v?.id ?? ""),
          title: String(v?.title ?? ""),
          videoUrl: String(v?.videoUrl ?? v?.video_url ?? v?.url ?? ""),
        }))
        .filter((v: any) => v.videoUrl.trim().length > 0),
    [landingMedia.data?.videos],
  );

  const openInstagram = (rawUrl?: string | null) => {
    const url = normalizeInstagramUrl(rawUrl);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const availableBarbers = useMemo(() => (barbers ?? []).filter((b) => b.role === "barber" && b.isAvailable !== false), [barbers]);
  const barberById = useMemo(() => new Map((barbers ?? []).map((b) => [Number(b.id), b])), [barbers]);
  useEffect(() => {
    if (!availableBarbers.length) return;
    if (!galleryBarberId) setGalleryBarberId(Number(availableBarbers[0].id));
  }, [availableBarbers, galleryBarberId]);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="relative pt-8 md:pt-12 pb-14 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-cover bg-center pc-bg-pan" style={{ backgroundImage: `url('${HERO_BG}')` }} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/55 to-black/35" />
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-10 items-start relative z-10">
          <div className="order-2 lg:order-1 space-y-6 text-white fade-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider">
              {t("priorityBadge")}
            </div>
            <h1 className="text-4xl md:text-6xl leading-tight font-semibold">
              {t("heroLine1")}
              <br />
              {t("heroLine2")}
              <br />
              {t("heroLine3")}
            </h1>
            <p className="max-w-xl text-lg text-zinc-100">
              {t("heroDesc")}
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/20 bg-black/25 p-4 fade-rise pc-hover-lift">
                <CalendarClock className="w-5 h-5 text-amber-300 mb-2" />
                <p className="font-semibold">{t("realtimeApproval")}</p>
                <p className="text-sm text-zinc-200">{t("realtimeApprovalDesc")}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-black/25 p-4 fade-rise pc-hover-lift">
                <ShieldCheck className="w-5 h-5 text-amber-300 mb-2" />
                <p className="font-semibold">{t("prioritySystem")}</p>
                <p className="text-sm text-zinc-200">{t("prioritySystemDesc")}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-black/25 p-4 fade-rise pc-hover-lift">
                <Gift className="w-5 h-5 text-amber-300 mb-2" />
                <p className="font-semibold">{t("loyaltyRewards")}</p>
                <p className="text-sm text-zinc-200">{t("loyaltyRewardsDesc")}</p>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <ReservationForm preselectedBarberId={selectedBarberId} />
          </div>
        </div>
      </section>

      <section id="timetable" className="py-10 md:py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 gap-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <h2 className="text-2xl font-semibold mb-3">{t("team")}</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">{t("teamTapPhoto")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableBarbers.map((barber) => {
                const instagramUrl = normalizeInstagramUrl(barber.instagramUrl);
                return (
                  <button
                    key={barber.id}
                    type="button"
                    onClick={() => setConfirmBarberId(barber.id)}
                    className="group rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-800/70 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <div className="relative">
                      <img
                        src={barber.photoUrl || "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80"}
                        alt={`${barber.firstName} ${barber.lastName}`}
                        className="h-36 w-full rounded-md object-cover mb-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInstagram(barber.instagramUrl);
                        }}
                      />
                      <span className={`absolute inset-x-2 bottom-3 rounded-md px-2 py-1 text-xs font-semibold text-white bg-black/70 transition ${instagramUrl ? "opacity-100 sm:opacity-0 sm:group-hover:opacity-100" : "opacity-100"}`}>
                        {instagramUrl ? "Go to Instagram" : "Instagram not set"}
                      </span>
                    </div>
                    <p className="font-semibold">{barber.firstName} {barber.lastName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-300">{t("reserveWith")} {barber.firstName}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-2 md:py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 md:col-span-2">
            <h3 className="text-xl font-semibold mb-2">Barber Gallery</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">Choose a barber and see their latest posts.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {availableBarbers.map((barber) => (
                <Button
                  key={`gallery-picker-${barber.id}`}
                  type="button"
                  variant={galleryBarberId === Number(barber.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGalleryBarberId(Number(barber.id))}
                >
                  {barber.firstName}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(clientGallery.data ?? []).map((img: any) => (
                <div key={`gallery-public-${img.id}`} className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                  <img
                    src={img.image_url || img.imageUrl}
                    alt={img.caption || "Gallery"}
                    className="h-28 w-full object-cover cursor-zoom-in"
                    onClick={() => setZoomedMedia({ src: img.image_url || img.imageUrl, title: img.caption || "Barber post", type: "image" })}
                  />
                  <p className="text-xs px-2 py-1 text-zinc-600 dark:text-zinc-300 truncate">{img.caption || "Barber post"}</p>
                </div>
              ))}
              {(clientGallery.data ?? []).length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-300 col-span-full">No gallery posts for this barber yet.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 md:col-span-1">
            <h3 className="text-xl font-semibold mb-2">Photo Boxes</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">Add before/after photos, team highlights, and shop vibes.</p>
            <div className="grid grid-cols-2 gap-2">
              {landingPhotoItems.map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  className="group relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-950 text-left"
                  onClick={() => setZoomedMedia({ src: p.imageUrl, title: p.title || "Photo", type: "image" })}
                >
                  <img
                    src={p.imageUrl}
                    alt={p.title || "Photo"}
                    className="h-28 w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 py-2">
                    <p className="text-xs font-medium text-white truncate">{p.title || "Photo"}</p>
                    <p className="text-[11px] text-zinc-200">Tap to enlarge</p>
                  </div>
                </button>
              ))}
              {landingPhotoItems.length === 0 ? (
                <>
                  <div className="rounded-lg h-16 border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-300">Photo 1</div>
                  <div className="rounded-lg h-16 border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-300">Photo 2</div>
                  <div className="rounded-lg h-16 border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-300">Photo 3</div>
                  <div className="rounded-lg h-16 border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-300">Photo 4</div>
                </>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 md:col-span-3">
            <h3 className="text-xl font-semibold mb-2">Video Boxes</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">Reserve slots for reels, transformations, or tutorials.</p>
            <div className="grid md:grid-cols-3 gap-2">
              {landingVideoItems.map((v: any) => (
                <button
                  key={v.id}
                  type="button"
                  className="group relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-950 text-left"
                  onClick={() => setZoomedMedia({ src: v.videoUrl, title: v.title || "Video", type: "video" })}
                >
                  <video
                    className="h-44 w-full object-cover"
                    src={v.videoUrl}
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 px-3 py-3">
                    <p className="text-sm font-medium text-white truncate">{v.title || "Video"}</p>
                    <p className="text-xs text-zinc-200">Tap to open</p>
                  </div>
                </button>
              ))}
              {landingVideoItems.length === 0 ? (
                <>
                  <div className="rounded-lg h-20 border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-300">Video slot 1</div>
                  <div className="rounded-lg h-20 border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-300">Video slot 2</div>
                  <div className="rounded-lg h-20 border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-300">Video slot 3</div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {!barbers && (
        <div className="container">
          <div className="pole">
            <div className="head" />
            <div className="head-base" />
            <div className="loader-head" />
            <div className="loader">
              <div className="inset">
                <div className="red" />
                <div className="blue" />
                <div className="red" />
                <div className="blue" />
                <div className="red" />
                <div className="blue" />
              </div>
            </div>
            <div className="loader-base" />
            <div className="base" />
            <div className="head-2" />
          </div>
        </div>
      )}

      {confirmBarberId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-sm w-full">
            <p className="font-semibold mb-2">{t("confirmReserve")}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-5">
              {t("reserveWith")} {barberById.get(confirmBarberId)?.firstName} {barberById.get(confirmBarberId)?.lastName}
            </p>
            <div className="mb-4">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-2">Portfolio preview</p>
              <div className="grid grid-cols-3 gap-2">
                {(gallery.data ?? []).slice(0, 3).map((img: any) => (
                  <img
                    key={img.id}
                    src={img.image_url || img.imageUrl}
                    alt={img.caption || "Portfolio"}
                    className="h-20 w-full rounded object-cover cursor-zoom-in"
                    onClick={() => setZoomedMedia({ src: img.image_url || img.imageUrl, title: img.caption || "Portfolio", type: "image" })}
                  />
                ))}
                {(!gallery.data || gallery.data.length === 0) ? <p className="text-xs text-zinc-500 dark:text-zinc-300 col-span-3">No gallery photos yet.</p> : null}
              </div>
            </div>
            <div className="flex gap-3">
              <Button className="w-full" onClick={() => { setSelectedBarberId(confirmBarberId); setConfirmBarberId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                {t("yes")}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setConfirmBarberId(null)}>
                {t("no")}
              </Button>
            </div>
          </div>
        </div>
      )}
      {zoomedMedia ? (
        <div
          className="fixed inset-0 z-[60] bg-black/85 p-4 md:p-8 flex items-center justify-center"
          onClick={() => setZoomedMedia(null)}
        >
          <div className="w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <Button type="button" variant="outline" className="bg-white/90 hover:bg-white text-zinc-900" onClick={() => setZoomedMedia(null)}>
                Close
              </Button>
            </div>
            {zoomedMedia.type === "video" ? (
              <video
                src={zoomedMedia.src}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[82vh] rounded-xl border border-white/20 bg-black"
              />
            ) : (
              <img src={zoomedMedia.src} alt={zoomedMedia.title} className="w-full max-h-[82vh] object-contain rounded-xl border border-white/20 bg-black" />
            )}
            {zoomedMedia.title ? <p className="mt-2 text-center text-sm text-zinc-200">{zoomedMedia.title}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
