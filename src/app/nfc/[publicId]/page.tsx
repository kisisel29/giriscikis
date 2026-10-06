import { NfcFlow } from "@/components/nfc/nfc-flow";

export default async function NfcPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <NfcFlow publicId={publicId} />;
}
