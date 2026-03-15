import Image from "next/image";
import { Indie_Flower } from "next/font/google";

const indie = Indie_Flower({ subsets: ["latin"], weight: ["400"] });

type ErrorPageProps = {
  searchParams?: {
    reason?: string;
  };
};

const errorCopy: Record<string, { title: string; message: string }> = {
  invalid: {
    title: "This coupon is invalid",
    message: "Check the link or ask the event team for a fresh coupon.",
  },
  redeemed: {
    title: "This coupon was already used",
    message: "Each coupon can only be redeemed once.",
  },
  scheduled: {
    title: "This coupon is not active yet",
    message: "Each coupon only works on its assigned Sunday.",
  },
  expired: {
    title: "This coupon has expired",
    message: "Each coupon only works on its assigned Sunday.",
  },
  server: {
    title: "We could not redeem that coupon",
    message: "The service is having trouble right now. Try again in a moment.",
  },
};

export default function ErrorPage({ searchParams }: ErrorPageProps) {
  const reason = searchParams?.reason && searchParams.reason in errorCopy ? searchParams.reason : "server";
  const content = errorCopy[reason];

  return (
    <main className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-between p-6 sm:p-8 pb-footer">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col items-center">
        <div className="pt-6 pb-4 text-center h-32 flex flex-col justify-center">
          <h1 className={`text-3xl font-bold font-thick ${indie.className}`}>{content.title}</h1>
        </div>

        <div className="my-10 flex items-center justify-center">
          <Image src="/loadcat.gif" alt="Error animation" width={144} height={144} />
        </div>

        <div className="w-full">
          <p className="text-center text-gray-600">{content.message}</p>
          <div className="relative w-full max-w-sm mx-auto h-14 rounded-full bg-gray-200 flex items-center select-none touch-none mt-6">
            <a
              href="https://t.me/lyazelda"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center text-gray-600 font-bold no-underline"
            >
              Message Developer
            </a>
          </div>

          <footer className="w-full max-w-sm mx-auto mt-32 pb-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-20 h-20 rounded-full overflow-hidden">
                <Image
                  src="/webe-cafe-logo.jpg"
                  alt="webe cafe logo"
                  width={80}
                  height={80}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span>Vibe coded by AI Fusion Labs</span>
              <Image src="/aifusionlabs-logo.png" alt="AI Fusion Labs logo" width={30} height={30} />
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
