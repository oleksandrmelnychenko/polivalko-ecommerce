import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { categoryPhotos } from "@polivalko/shared/lib/stand-in-photos";
import { getServiceDirections } from "../api/server";
import { DirectionRequestLink } from "./direction-request-link";

const THEMES = [
  { code: "landscape-design", title: "Ландшафтний дизайн", text: "Планування та озеленення ділянки", photo: categoryPhotos["landshaftnyi-dyzain"] },
  { code: "irrigation-installation", title: "Автополив", text: "Проєктування, монтаж і сервіс", photo: categoryPhotos["vse-dlia-polyvu"] },
  { code: "garden-care", title: "Догляд за садом", text: "Газони та сезонний догляд", photo: categoryPhotos["vse-dlia-roslyn"] },
];
const STEPS = [
  { title: "Залиште заявку", text: "Вкажіть послугу, телефон і коротко опишіть потрібні роботи." },
  { title: "Узгодимо деталі", text: "Менеджер передзвонить у робочий час і уточнить обсяг робіт." },
  { title: "Домовимося про виїзд", text: "Разом оберемо зручний день для зустрічі на вашій ділянці." },
];

export function ServicesScreen() {
  return <div className="container garden-services">
    <JsonLd data={breadcrumbJsonLd([{ name: "Послуги", path: "/services" }])} />
    <nav className="crumbs" aria-label="Хлібні крихти"><ol><li><Link href="/">Головна</Link></li><li aria-current="page">Послуги</li></ol></nav>
    <header className="garden-services__heading">
      <h1>Послуги для саду</h1>
    </header>
    <div className="garden-scenes" aria-label="Послуги для вашого саду">
      {THEMES.map(({ code, title, text, photo }) => <Link href={`/contacts?direction=${code}#request`} key={code} className="garden-scene">
        <img src={photo.url} alt={photo.alt} width={600} height={480} />
        <div><span><strong>{title}</strong><span>{text}</span></span><ArrowRightIcon /></div>
      </Link>)}
    </div>
    <Suspense fallback={<div className="skeleton" style={{ height: 480, marginTop: 64 }} />}><ServicesContent /></Suspense>
  </div>;
}

async function ServicesContent() {
  await connection();
  const directions = await getServiceDirections();
  return <>
    <section className="garden-directions" aria-labelledby="directions-title">
      <div className="garden-directions__intro"><h2 id="directions-title">Наші послуги</h2><p>Оберіть потрібні роботи. Обсяг, вартість і терміни узгодимо під час консультації.</p><Link href="#request" className="services-link">Отримати консультацію</Link></div>
      <div className="garden-directions__list">
        {directions.map((direction, i) => <details key={direction.code} className="garden-direction" name="garden-direction" open={i === 0}>
          <summary><h3>{direction.name}</h3><span aria-hidden="true" className="garden-direction__toggle" /></summary>
          <div>{direction.description && <p>{direction.description}</p>}<DirectionRequestLink code={direction.code} /></div>
        </details>)}
      </div>
    </section>
    <section className="garden-request" id="request" aria-labelledby="request-title">
      <div className="garden-request__intro">
        <h2 id="request-title">Як замовити послугу</h2>
        <p>Зателефонуйте або залиште заявку на сторінці контактів. Узгодимо роботи для вашої ділянки.</p>
        <Link href="/contacts" className="btn">Перейти до контактів <ArrowRightIcon /></Link>
      </div>
      <ol className="garden-request__steps">{STEPS.map((step, i) => <li key={step.title}><span className="garden-request__number" aria-hidden="true">{i + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
    </section>
  </>;
}
