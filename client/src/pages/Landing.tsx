import { ReservationForm } from "@/components/ReservationForm";
import { Navbar } from "@/components/layout/Navbar";
import { useBarbers } from "@/hooks/use-barbers";
import { CalendarClock, ShieldCheck, Gift } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";

const HERO_BG =
  "https://static.vecteezy.com/ti/photos-gratuite/t2/65578350-cette-bien-equipe-salon-de-coiffure-caracteristiques-une-tondeuse-en-train-de-preparer-pour-barbe-toilettage-seances-photo.jpg";

export default function Landing() {
  const { data: barbers } = useBarbers();
  const { t } = useI18n();
  const [selectedBarberId, setSelectedBarberId] = useState<number | null>(null);
  const [confirmBarberId, setConfirmBarberId] = useState<number | null>(null);
  const barberById = useMemo(() => new Map((barbers ?? []).map((b) => [Number(b.id), b])), [barbers]);
  return (
    <div className="min-h-screen bg-background text-zinc-900">
      <Navbar />

      <section className="relative pt-8 md:pt-12 pb-14 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${HERO_BG}')` }} />
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
              <div className="rounded-xl border border-white/20 bg-black/25 p-4 fade-rise">
                <CalendarClock className="w-5 h-5 text-amber-300 mb-2" />
                <p className="font-semibold">{t("realtimeApproval")}</p>
                <p className="text-sm text-zinc-200">{t("realtimeApprovalDesc")}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-black/25 p-4 fade-rise">
                <ShieldCheck className="w-5 h-5 text-amber-300 mb-2" />
                <p className="font-semibold">{t("prioritySystem")}</p>
                <p className="text-sm text-zinc-200">{t("prioritySystemDesc")}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-black/25 p-4 fade-rise">
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
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-2xl font-semibold mb-3">{t("team")}</h2>
            <p className="text-zinc-600 mb-4">{t("teamTapPhoto")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(barbers ?? []).filter((b) => b.role === "barber" && b.isAvailable !== false).map((barber) => (
                <button
                  key={barber.id}
                  type="button"
                  onClick={() => setConfirmBarberId(barber.id)}
                  className="group rounded-lg border border-zinc-200 p-3 bg-zinc-50 text-left hover:bg-zinc-100 transition"
                >
                  <img
                    src={barber.photoUrl || "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80"}
                    alt={`${barber.firstName} ${barber.lastName}`}
                    className="h-36 w-full rounded-md object-cover mb-2"
                  />
                  <p className="font-semibold">{barber.firstName} {barber.lastName}</p>
                  <p className="text-xs text-zinc-500">{t("reserveWith")} {barber.firstName}</p>
                </button>
              ))}
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
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <p className="font-semibold mb-2">{t("confirmReserve")}</p>
            <p className="text-sm text-zinc-600 mb-5">
              {t("reserveWith")} {barberById.get(confirmBarberId)?.firstName} {barberById.get(confirmBarberId)?.lastName}
            </p>
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
    </div>
  );
}
