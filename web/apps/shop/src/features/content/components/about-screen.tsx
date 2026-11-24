import Link from "next/link";
import { seoMetadata, JsonLd, breadcrumbJsonLd } from "@/features/seo";
import { categoryPhotos, pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { ArrowRightIcon, BagIcon, PhoneIcon, StoreIcon, TruckIcon, TagIcon, CheckIcon } from "@polivalko/shared/ui/icons";

export const metadata = seoMetadata({ title: "Про Полі-Валько", description: "Полі-Валько — магазин товарів для дому, саду й городу в Бучі. Полив, інструменти, садова техніка та послуги для вашої ділянки.", path: "/about" });

const ranges = [
  { slug: "vse-dlia-polyvu", title: "Товари для поливу", text: "Шланги, дощувачі та з'єднання для грядок, клумб і газону." },
  { slug: "vse-dlia-roslyn", title: "Товари для рослин", text: "Ґрунти, добрива, насіння й горщики для вирощування та догляду за рослинами." },
  { slug: "ruchnyi-instrument", title: "Садовий інструмент", text: "Лопати, граблі, секатори та інший інструмент для роботи на ділянці." },
  { slug: "vse-dlia-vidpochynku", title: "Товари для відпочинку", text: "Садові меблі, грилі й гамаки для тераси та подвір’я." },
];
const benefits = [
  { icon: BagIcon, title: "Усе для дому й ділянки", text: "Полив, рослини, інструменти, техніка та сезонні товари в одному каталозі." },
  { icon: PhoneIcon, title: "Допомога з вибором", text: "Допоможемо підібрати товар телефоном або в магазині." },
  { icon: TruckIcon, title: "Доставка Україною", text: "Нова пошта: у відділення, поштомат або кур'єром за адресою." },
  { icon: StoreIcon, title: "Самовивіз із магазину", text: "Безкоштовний самовивіз із магазину після підтвердження готовності." },
  { icon: TagIcon, title: "Акції", text: "Актуальні товари за зниженою ціною зібрані в розділі «Акції»." },
  { icon: CheckIcon, title: "Послуги для саду", text: "Від ландшафтного проєкту й автополиву до сезонного догляду." },
];

export default function AboutPage() {
  return <div className="container story-page">
    <JsonLd data={breadcrumbJsonLd([{ name: "Про нас", path: "/about" }])} />
    <header className="page-head"><h1>Про Полі-Валько</h1></header>
    <section className="story-intro">
      <img src={pagePhotos.services.url} alt={pagePhotos.services.alt} width={900} height={740} />
      <div><h2>Магазин для саду, городу й дому</h2><p>У каталозі — товари для поливу, вирощування рослин, роботи в саду та відпочинку. Замовляйте онлайн із доставкою Новою поштою або обирайте товари в магазині в Бучі.</p><p>Також приймаємо заявки на ландшафтний дизайн, озеленення, монтаж і сервіс автополиву та догляд за садом.</p><div className="story-actions"><Link href="/catalog" className="btn">Обрати товари <ArrowRightIcon /></Link><Link href="/contacts" className="btn btn--outline">Зв’язатися з нами</Link></div></div>
    </section>
    <section className="story-section"><div className="story-section__head"><h2>Основні категорії</h2><p>Полив, догляд за рослинами, інструменти та облаштування подвір’я.</p></div><div className="story-ranges">{ranges.map(r=><Link key={r.slug} href={"/catalog/"+r.slug} className="story-range"><img src={categoryPhotos[r.slug].url} alt={categoryPhotos[r.slug].alt} width={500} height={400} loading="lazy" /><h3>{r.title}</h3><p>{r.text}</p><span>До каталогу <ArrowRightIcon /></span></Link>)}</div></section>
    <section className="story-section"><div className="story-section__head"><h2>Покупки у зручний для вас спосіб</h2></div><div className="story-benefits">{benefits.map(b=><article key={b.title}><span><b.icon /></span><div><h3>{b.title}</h3><p>{b.text}</p></div></article>)}</div></section>
    <section className="story-cta"><div><h2>Озеленення, автополив<br />і догляд за садом</h2><p>Залиште заявку на потрібну послугу. Менеджер уточнить обсяг робіт і домовиться з вами про подальші дії.</p></div><Link href="/contacts#request" className="btn">Залишити заявку <ArrowRightIcon /></Link></section>
  </div>;
}
