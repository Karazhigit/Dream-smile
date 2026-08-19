import { About } from "@/components/about";
import { Contact } from "@/components/contact";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Services } from "@/components/services";
import { Specialists } from "@/components/specialists";

export default function Home() {
  return <><Header /><main><Hero /><Services /><Specialists /><About /><Contact /></main><Footer /></>;
}
