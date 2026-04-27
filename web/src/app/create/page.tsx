import Link from "next/link";
import { CreateGalleryForm } from "../../components/CreateGalleryForm";

export default function CreateGalleryPage() {
  return (
    <main style={{ display: "grid", gap: "16px" }}>
      <Link href="/">Back</Link>
      <h1>Create gallery</h1>
      <CreateGalleryForm />
    </main>
  );
}
