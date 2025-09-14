import React, { useEffect, useMemo, useRef, useState } from "react";

// Детский «Калькулятор Мечты» — i18n, печать, таблица роста взносов, название мечты
// Новое:
// - Кнопка Печать надёжнее (client-only handler + небольшой delay)
// - Переключатель языка RU/EN
// - Поле «Название мечты» — используется в печати как заголовок
// - Таблица по годам: показываем взнос за период с учётом годового роста и разницу к базовому
// - Пояснение: почему ежедневные взносы дают больший эффект; в списке частоты выделено жирным «Каждый день»
// - Сохранена авто‑проверка формул

export default function DreamCalculator() {
  // ===== Язык =====
  const [lang, setLang] = useState("ru");

  // ===== Калькулятор №1: «Сколько вырастет моя копилка?» =====
  const [m1, setM1] = useState(100); // базовый взнос за период
  const [years1, setYears1] = useState(10); // срок, лет
  const [useMagic1, setUseMagic1] = useState(true); // сложный процент
  const [rate1, setRate1] = useState(8); // годовая ставка, %
  const [freq1, setFreq1] = useState("monthly"); // частота: daily | biweekly | monthly
  const [inc1, setInc1] = useState(0); // рост взноса раз в год, %

  // ===== Калькулятор №2: «Хочу купить мечту — сколько откладывать?» =====
  const [dreamName, setDreamName] = useState("");
  const [goal, setGoal] = useState(20000); // цена мечты
  const [years2, setYears2] = useState(5); // через сколько лет
  const [useMagic2, setUseMagic2] = useState(true); // учитывать сложный процент
  const [rate2, setRate2] = useState(8); // годовая ставка, %
  const [freq2, setFreq2] = useState("monthly"); // частота взносов

  const t = useMemo(() => getStrings(lang), [lang]);

  // Печать: более надёжный хендлер (иногда на некоторых платформах прямой window.print может игнориться)
  const printingRef = useRef(false);
  const handlePrint = () => {
    if (typeof window === "undefined") return;
    if (printingRef.current) return;
    printingRef.current = true;
    setTimeout(() => {
      try { window.print(); } finally { printingRef.current = false; }
    }, 50);
  };

  // Вспомогательные функции
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmt2 = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const periodsPerYear = (freq) => ({ daily: 365, biweekly: 26, monthly: 12 }[freq] || 12);

  // Будущая стоимость копилки при взносах по периодам и годовом росте взноса
  // Взнос в начале периода (annuity-due), затем проценты — прибыль не снимаем, всё реинвестируется
  function futureValueVariableContribution(basePerPeriod, annualRatePct, years, useCompound, freq, annualIncreasePct) {
    const PY = periodsPerYear(freq);
    const totalPeriods = Math.round(clamp(years, 1, 50) * PY);
    const r = useCompound ? (annualRatePct / 100) / PY : 0;
    const gYear = annualIncreasePct / 100; // рост в год

    let sum = 0; // накопленная сумма
    let invested = 0; // всего вложено

    for (let p = 0; p < totalPeriods; p++) {
      const yearIndex = Math.floor(p / PY); // какой это год, начиная с 0
      const contribThisPeriod = basePerPeriod * Math.pow(1 + gYear, yearIndex);
      sum += contribThisPeriod; // кладём взнос в начале периода
      invested += contribThisPeriod;
      if (r > 0) sum *= (1 + r); // проценты на всю сумму (реинвест)
    }

    return { fv: sum, invested, interest: sum - invested };
  }

  // Какую сумму нужно откладывать за период, чтобы достичь цели (без роста взноса для простоты детского калькулятора)
  function periodicForGoal(goalAmount, annualRatePct, years, useCompound, freq) {
    const PY = periodsPerYear(freq);
    const n = Math.round(clamp(years, 1, 50) * PY);
    if (n <= 0) return goalAmount;
    if (!useCompound || annualRatePct <= 0) {
      return goalAmount / n; // равные доли без процентов
    }
    const r = (annualRatePct / 100) / PY;
    const denom = Math.pow(1 + r, n) - 1;
    if (denom <= 0) return goalAmount / n;
    return goalAmount * r / denom; // взносы в конце периода (ordinary)
  }

  const res1 = useMemo(
    () => futureValueVariableContribution(Number(m1), Number(rate1), Number(years1), useMagic1, freq1, Number(inc1)),
    [m1, rate1, years1, useMagic1, freq1, inc1]
  );

  const needPeriodic2 = useMemo(
    () => periodicForGoal(Number(goal), Number(rate2), Number(years2), useMagic2, freq2),
    [goal, rate2, years2, useMagic2, freq2]
  );

  // Данные для диаграммы роста (по годам)
  const chartData1 = useMemo(() => {
    const Y = clamp(years1, 1, 50);
    const PY = periodsPerYear(freq1);
    const r = useMagic1 ? (rate1 / 100) / PY : 0;
    const gYear = inc1 / 100;
    const arr = [];
    let sum = 0;

    for (let year = 0; year <= Y; year++) {
      if (year === 0) { arr.push({ year: 0, total: 0, invested: 0 }); continue; }
      let investedYear = 0;
      for (let i = 0; i < PY; i++) {
        const pGlobal = (year - 1) * PY + i; // номер периода с начала накопления
        const yIdx = Math.floor(pGlobal / PY);
        const contrib = Number(m1) * Math.pow(1 + gYear, yIdx);
        sum += contrib;
        investedYear += contrib;
        if (r > 0) sum *= (1 + r);
      }
      const investedTotal = arr[year - 1].invested + investedYear;
      arr.push({ year, total: sum, invested: investedTotal });
    }
    return arr;
  }, [m1, years1, useMagic1, rate1, freq1, inc1]);

  // Таблица по годам: взнос за период с учётом годового роста и разница к базовому взносу
  const contributionTable = useMemo(() => {
    const Y = clamp(years1, 1, 50);
    const PY = periodsPerYear(freq1);
    const base = Number(m1);
    const gYear = inc1 / 100;
    const rows = [];
    for (let year = 1; year <= Y; year++) {
      const factor = Math.pow(1 + gYear, year - 1);
      const perPeriod = base * factor;
      const delta = perPeriod - base;
      const investedYear = perPeriod * PY;
      rows.push({ year, perPeriod, delta, investedYear });
    }
    return { PY, rows };
  }, [years1, freq1, m1, inc1]);

  // ===== Тесты (самопроверка) =====
  const tests = useMemo(() => runSelfTests({
    periodicForGoal,
    futureValueVariableContribution,
    periodsPerYear,
  }), [periodicForGoal, futureValueVariableContribution]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-sky-50 to-emerald-50 text-slate-800">
      {/* Печать: шапка только для печати с названием мечты */}
      <div className="print-only hidden text-center py-4">
        <h1 className="text-2xl font-black">{dreamName ? `${t.printTitle}: ${dreamName}` : t.appTitle}</h1>
      </div>

      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            ✨ {t.appTitle}
          </h1>
          <div className="flex gap-2 items-center">
            <LangSwitch lang={lang} setLang={setLang} />
            <button type="button" onClick={handlePrint} className="px-4 py-2 rounded-2xl shadow bg-slate-900 text-white text-sm font-semibold hover:opacity-90">
              🖨️ {t.print}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-10">
        {/* Блок-подсказка */}
        <div className="grid md:grid-cols-2 gap-4">
          <TipCard title={t.howWorks} emoji="🧠">
            {t.howWorksText}
          </TipCard>
          <TipCard title={t.growthSecret} emoji="🌱">
            {t.growthSecretText}
          </TipCard>
        </div>

        {/* Калькулятор 1 */}
        <SectionCard title={t.savingsCalcTitle} subtitle={t.savingsCalcSubtitle}>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Управление */}
            <div className="space-y-5">
              <Field label={t.amountPerPeriod} hint={t.amountPerPeriodHint}>
                <NumberInput value={m1} onChange={setM1} min={0} max={100000} step={10} />
              </Field>

              <Field label={t.howOften} hint={<span>{t.howOftenHint} <b>{t.daily}</b> — {t.mostProfitable}</span>}>
                <select className="w-full rounded-2xl border px-3 py-2" value={freq1} onChange={(e) => setFreq1(e.target.value)}>
                  <option value="daily"><b>{t.daily}</b></option>
                  <option value="biweekly">{t.biweekly}</option>
                  <option value="monthly">{t.monthly}</option>
                </select>
              </Field>

              <Field label={`${t.term} (${years1} ${t.years})`} hint={t.termHint}>
                <input type="range" min={1} max={50} value={years1} onChange={(e) => setYears1(Number(e.target.value))} className="w-full" />
              </Field>

              <div className="flex items-center gap-3">
                <input id="magic1" type="checkbox" checked={useMagic1} onChange={(e) => setUseMagic1(e.target.checked)} className="h-5 w-5" />
                <label htmlFor="magic1" className="font-semibold">{t.magicPercentLabel}</label>
              </div>

              <Field label={t.annualRate} hint={t.annualRateHint}>
                <NumberInput value={rate1} onChange={setRate1} min={0} max={20} step={0.5} disabled={!useMagic1} />
              </Field>

              <Field label={`${t.increasePerYear} (${inc1}% ${t.perYear})`} hint={t.increaseHint}>
                <input type="range" min={0} max={100} value={inc1} onChange={(e) => setInc1(Number(e.target.value))} className="w-full" />
              </Field>
            </div>

            {/* Итоги + мини‑диаграмма */}
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <Stat title={t.totalWillBe} value={`$${fmt2(res1.fv)}`} emoji="🎉" />
                <Stat title={t.totalInvested} value={`$${fmt2(res1.invested)}`} emoji="🧺" />
                <Stat title={t.magicGain} value={`$${fmt2(res1.interest)}`} emoji="✨" />
              </div>

              <MiniChart data={chartData1} />

              <p className="text-sm text-slate-600">
                {t.increaseNote}
              </p>
            </div>
          </div>

          {/* Таблица по годам */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-2xl overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 text-left">{t.year}</th>
                  <th className="p-2 text-left">{t.perPeriodNow}</th>
                  <th className="p-2 text-left">{t.deltaVsStart}</th>
                  <th className="p-2 text-left">{t.investedThisYear} ({t.periods}: {contributionTable.PY})</th>
                </tr>
              </thead>
              <tbody>
                {contributionTable.rows.map(r => (
                  <tr key={r.year} className="odd:bg-white even:bg-slate-50">
                    <td className="p-2">{r.year}</td>
                    <td className="p-2">${fmt2(r.perPeriod)}</td>
                    <td className="p-2">{r.delta >= 0 ? "+" : ""}${fmt2(r.delta)}</td>
                    <td className="p-2">${fmt2(r.investedYear)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Калькулятор 2 */}
        <SectionCard title={t.goalCalcTitle} subtitle={t.goalCalcSubtitle}>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Управление */}
            <div className="space-y-5">
              <Field label={t.dreamName} hint={t.dreamNameHint}>
                <input className="w-full rounded-2xl border px-3 py-2" value={dreamName} onChange={(e) => setDreamName(e.target.value)} placeholder={t.dreamNamePlaceholder} />
              </Field>

              <Field label={t.goalPrice} hint={t.goalPriceHint}>
                <NumberInput value={goal} onChange={setGoal} min={0} max={100000000} step={500} />
              </Field>

              <Field label={t.howOften} hint={<span>{t.howOftenHint} <b>{t.daily}</b> — {t.mostProfitable}</span>}>
                <select className="w-full rounded-2xl border px-3 py-2" value={freq2} onChange={(e) => setFreq2(e.target.value)}>
                  <option value="daily"><b>{t.daily}</b></option>
                  <option value="biweekly">{t.biweekly}</option>
                  <option value="monthly">{t.monthly}</option>
                </select>
              </Field>

              <Field label={`${t.inHowManyYears} (${years2})`} hint={t.termHint}>
                <input type="range" min={1} max={50} value={years2} onChange={(e) => setYears2(Number(e.target.value))} className="w-full" />
              </Field>

              <div className="flex items-center gap-3">
                <input id="magic2" type="checkbox" checked={useMagic2} onChange={(e) => setUseMagic2(e.target.checked)} className="h-5 w-5" />
                <label htmlFor="magic2" className="font-semibold">{t.considerCompound}</label>
              </div>

              <Field label={t.annualRate} hint={t.annualRateHint2}>
                <NumberInput value={rate2} onChange={setRate2} min={0} max={20} step={0.5} disabled={!useMagic2} />
              </Field>
            </div>

            {/* Итоги */}
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <Stat title={t.needPerPeriod} value={`$${fmt2(needPeriodic2)}`} emoji="📦" />
                <Stat title={t.totalPeriods} value={`${fmt(years2 * periodsPerYear(freq2))}`} emoji="🗓️" />
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-inner leading-relaxed">
                <p className="font-semibold mb-1">{t.example}</p>
                <p>
                  {t.expl1} <b>${fmt(goal)}</b>, {t.expl2} <b>{years2} {t.years}</b>, {t.expl3} <b>{freqLabel(t, freq2)}</b>,
                  {t.expl4} <b>${fmt2(needPeriodic2)}</b> {t.perEachPeriod}.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Пояснялка */}
        <SectionCard title={t.kidsLegendTitle} subtitle={t.kidsLegendSubtitle}>
          <ul className="list-disc pl-6 space-y-2">
            <li><b>{t.perPeriod}</b> — {t.legendPerPeriod}</li>
            <li><b>{t.compound}</b> — {t.legendCompound}</li>
            <li><b>{t.annualRateShort}</b> — {t.legendAnnualRate}</li>
            <li><b>{t.increase}</b> — {t.legendIncrease}</li>
            <li><b>{t.termShort}</b> — {t.legendTerm}</li>
            <li><b>{t.daily}</b> — <span className="font-semibold text-emerald-700">{t.dailyWhy}</span></li>
          </ul>
        </SectionCard>

        {/* ТЕСТЫ (для взрослых) */}
        <details className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold">🔎 {t.techTests}</summary>
          <div className="mt-3 space-y-1">
            {tests.results.map((r, i) => (
              <div key={i} className={"flex items-center gap-2 " + (r.pass ? "text-emerald-700" : "text-rose-700") }>
                <span>{r.pass ? "✅" : "❌"}</span>
                <span className="font-mono">{r.name}</span>
                {!r.pass && <span className="text-xs">| expected≈{r.expected}, got={r.got}</span>}
              </div>
            ))}
            <div className="text-slate-600 mt-2">{t.passed}: {tests.passed} / {tests.total}</div>
          </div>
        </details>

        {/* Футер */}
        <footer className="text-center text-sm text-slate-500 py-6">
          {t.footer}
        </footer>
      </main>

      <style jsx global>{`
        @media print {
          header { display: none; }
          .print-only { display: block !important; }
          main { padding: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ====================== i18n ======================
function getStrings(lang) {
  if (lang === 'en') {
    return {
      appTitle: 'Dream Calculator',
      print: 'Print / PDF',
      printTitle: 'My Dream',
      howWorks: 'How does it work?',
      howWorksText: (<span>Turn on the <b>magic percent</b> to see <b>compound growth</b> (interest on interest). Turn it off to see only your own deposits.</span>),
      growthSecret: 'The secret of growth',
      growthSecretText: (<span>The most important things are <b>time</b> and <b>consistency</b>. Even small regular deposits turn into a big pile of coins!</span>),
      savingsCalcTitle: 'Piggy Bank: how much will I save?',
      savingsCalcSubtitle: 'Choose deposit, frequency, years and magic percent',
      amountPerPeriod: 'How much to deposit ($ per period)',
      amountPerPeriodHint: 'This is the amount for the chosen period (day/2 weeks/month)'
      ,howOften: 'How often to deposit',
      howOftenHint: 'Choose the frequency. ',
      mostProfitable: 'the most profitable for growth',
      daily: 'Daily',
      biweekly: 'Every 2 weeks',
      monthly: 'Monthly',
      term: 'Term', years: 'years', termHint: '1 to 50 years',
      magicPercentLabel: 'Magic percent (compound interest, do not withdraw profit)',
      annualRate: 'Annual rate %',
      annualRateHint: 'Example: 8% per year. Works when magic is on.',
      increasePerYear: 'Increase the deposit every year', perYear: 'per year',
      increaseHint: 'As a child grows, you can increase the deposit',
      totalWillBe: 'Total amount',
      totalInvested: 'Total invested',
      magicGain: 'Magic of interest',
      increaseNote: 'The deposit grows once a year. With magic on, interest also earns interest — we do not withdraw the profit.',
      year: 'Year', perPeriodNow: 'Per period this year', deltaVsStart: 'Δ vs year 1', investedThisYear: 'Invested this year', periods: 'periods',
      goalCalcTitle: 'Dream: how much to deposit?',
      goalCalcSubtitle: 'Enter the price, time and frequency — we will calculate the deposit',
      dreamName: 'Dream name', dreamNameHint: 'This will be used in print as a heading', dreamNamePlaceholder: 'Example: Trip to Lapland',
      goalPrice: 'Dream price ($)', goalPriceHint: 'Apartment, car, trip…',
      inHowManyYears: 'In how many years',
      considerCompound: 'Consider compound interest',
      annualRateHint2: 'Works when compound interest is on',
      needPerPeriod: 'Need per period', totalPeriods: 'Total periods',
      example: 'Example:',
      expl1: 'If the dream costs', expl2: 'the time is', expl3: 'and the frequency is', expl4: 'then you need to deposit about', perEachPeriod: 'each period',
      kidsLegendTitle: 'Kids legend', kidsLegendSubtitle: 'What do these words mean?',
      perPeriod: 'Deposit per period', legendPerPeriod: 'how much you put into the piggy bank each day/2 weeks/month',
      compound: 'Compound interest', legendCompound: 'interest also earns interest; we do not withdraw the profit',
      annualRateShort: 'Annual rate', legendAnnualRate: 'how many percent per year money grows (if magic is on)',
      increase: 'Deposit growth', legendIncrease: 'by how many % per year to increase the deposit as the child grows',
      termShort: 'Term', legendTerm: 'how many years you save',
      dailyWhy: 'earlier deposits start earning sooner, so the total becomes larger than with the same monthly deposits',
      techTests: 'Technical tests', passed: 'Passed',
      footer: 'Made with care 💙 — you can print as PDF and hang on the fridge.'
    };
  }

  // RU
  return {
    appTitle: 'Калькулятор Мечты',
    print: 'Печать / PDF',
    printTitle: 'Моя мечта',
    howWorks: 'Как это работает?',
    howWorksText: (<span>Включи <b>волшебный процент</b> — увидишь <b>сложный рост</b> (проценты на проценты). Выключи — увидишь только свои взносы.</span>),
    growthSecret: 'Секрет роста',
    growthSecretText: (<span>Главное — <b>время</b> и <b>регулярность</b>. Даже маленькие регулярные взносы превращаются в большую горку монет!</span>),
    savingsCalcTitle: 'Копилка: сколько получится накопить?',
    savingsCalcSubtitle: 'Выбирай взнос, частоту, годы и «волшебный процент»',
    amountPerPeriod: 'Сколько откладывать ($ за период)',
    amountPerPeriodHint: 'Это сумма за один выбранный период (день/2 недели/месяц)',
    howOften: 'Как часто откладывать',
    howOftenHint: 'Выбери частоту. ',
    mostProfitable: 'самый выгодный для роста',
    daily: 'Каждый день',
    biweekly: 'Каждые 2 недели',
    monthly: 'Каждый месяц',
    term: 'Срок', years: 'лет', termHint: 'От 1 до 50 лет',
    magicPercentLabel: 'Волшебный процент (сложный процент, прибыль не снимаем)',
    annualRate: 'Годовая ставка %',
    annualRateHint: 'Например, 8% в год. Работает, когда включён волшебный процент.',
    increasePerYear: 'Рост взноса каждый год', perYear: 'в год',
    increaseHint: 'Когда ребёнок растёт, можно увеличивать сумму взноса',
    totalWillBe: 'Всего накопится',
    totalInvested: 'Всего вложено',
    magicGain: 'Магия процентов',
    increaseNote: 'Взнос растёт на выбранный процент раз в год. При включённой магии проценты тоже приносят проценты — мы не снимаем прибыль.',
    year: 'Год', perPeriodNow: 'Взнос за период в этом году', deltaVsStart: 'Δ к 1‑му году', investedThisYear: 'Вложено за год', periods: 'периодов',
    goalCalcTitle: 'Мечта: сколько нужно откладывать?',
    goalCalcSubtitle: 'Укажи цену мечты, срок и частоту — мы посчитаем взнос',
    dreamName: 'Название мечты', dreamNameHint: 'Будет использовано при печати как заголовок', dreamNamePlaceholder: 'Например: Поездка в Лапландию',
    goalPrice: 'Цена мечты ($)', goalPriceHint: 'Квартира, машина, путешествие…',
    inHowManyYears: 'Через сколько лет',
    considerCompound: 'Учитывать сложный процент',
    annualRateHint2: 'Работает, когда включён сложный процент',
    needPerPeriod: 'Нужно за период', totalPeriods: 'Всего периодов',
    example: 'Пример:',
    expl1: 'Если мечта стоит', expl2: 'срок —', expl3: 'частота —', expl4: 'то нужно откладывать примерно', perEachPeriod: 'за каждый период',
    kidsLegendTitle: 'Пояснялка для детей', kidsLegendSubtitle: 'Что означают слова на этой странице?',
    perPeriod: 'Взнос за период', legendPerPeriod: 'сколько кладёшь в копилку каждый день/2 недели/месяц',
    compound: 'Сложный процент', legendCompound: 'проценты тоже приносят проценты; прибыль не снимаем — она растёт',
    annualRateShort: 'Годовая ставка', legendAnnualRate: 'на сколько % в год растут деньги (если включена магия)',
    increase: 'Рост взноса', legendIncrease: 'на сколько % в год увеличивать взнос, когда ребёнок становится старше',
    termShort: 'Срок', legendTerm: 'сколько лет копишь',
    dailyWhy: 'ранние взносы начинают работать раньше, поэтому итог больше, чем при тех же ежемесячных взносах',
    techTests: 'Технические тесты', passed: 'Пассов',
    footer: 'Сделано с заботой 💙 — можно распечатать как PDF и повесить на холодильник.'
  };
}

function freqLabel(t, freq) {
  if (freq === 'daily') return t.daily;
  if (freq === 'biweekly') return t.biweekly;
  return t.monthly;
}

function LangSwitch({ lang, setLang }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setLang('ru')} className={`px-2 py-1 rounded-lg border ${lang==='ru'?'bg-slate-900 text-white':'bg-white'}`}>RU</button>
      <button type="button" onClick={() => setLang('en')} className={`px-2 py-1 rounded-lg border ${lang==='en'?'bg-slate-900 text-white':'bg-white'}`}>EN</button>
    </div>
  );
}

// ====================== Компоненты UI ======================
function SectionCard({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1">{title}</h2>
      {subtitle && <p className="text-slate-600 mb-5">{subtitle}</p>}
      {children}
    </section>
  );
}

function TipCard({ title, emoji, children }) {
  return (
    <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl" role="img" aria-label="emoji">{emoji}</span>
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      <div className="text-slate-700 leading-relaxed">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block font-semibold">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function NumberInput({ value, onChange, min = 0, max = 1_000_000_000, step = 1, disabled }) {
  return (
    <div className={`flex items-center rounded-2xl border ${disabled ? 'bg-slate-100 opacity-70' : 'bg-white'} px-2` }>
      <button
        type="button"
        className="px-3 py-2 text-xl leading-none"
        onClick={() => !disabled && onChange(clampNum(Number(value) - step, min, max))}
        disabled={disabled}
        aria-label="minus"
      >−</button>
      <input
        type="number"
        className="w-full py-2 px-2 text-lg outline-none bg-transparent"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(clampNum(Number(e.target.value), min, max))}
        disabled={disabled}
      />
      <button
        type="button"
        className="px-3 py-2 text-xl leading-none"
        onClick={() => !disabled && onChange(clampNum(Number(value) + step, min, max))}
        disabled={disabled}
        aria-label="plus"
      >+</button>
    </div>
  );
}

function clampNum(x, min, max) { return Math.max(min, Math.min(max, x)); }

function Stat({ title, value, emoji }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center shadow-sm">
      <div className="text-2xl" role="img" aria-label="emoji">{emoji}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-slate-500 font-semibold">{title}</div>
      <div className="mt-1 text-xl sm:text-2xl font-extrabold">{value}</div>
    </div>
  );
}

// Мини‑диаграмма без сторонних библиотек — простая SVG‑линия
function MiniChart({ data }) {
  if (!data || data.length < 2) return null;
  const W = 560, H = 180, P = 12;
  const maxY = Math.max(...data.map(d => Math.max(d.total, d.invested))) || 1;
  const minY = 0;
  const scaleX = (i) => P + (i * (W - 2 * P)) / (data.length - 1);
  const scaleY = (v) => H - P - ((v - minY) / (maxY - minY)) * (H - 2 * P);

  const line = (key, dash = false) => (
    <path
      d={data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d[key])}`).join(' ')}
      fill="none"
      stroke={dash ? "#64748b" : "#0ea5e9"}
      strokeWidth={3}
      strokeDasharray={dash ? "6 6" : "none"}
    />
  );

  const dots = (key, color) => data.map((d, i) => (
    <circle key={i+key} cx={scaleX(i)} cy={scaleY(d[key])} r={2.5} fill={color} />
  ));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-3 px-1 pb-2 text-sm">
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 bg-sky-500 rounded" /> Итог</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 bg-slate-500 rounded" /> Инвестировано</div>
      </div>
      <svg width="100%" viewBox={`0 0 ${560} ${180}`} role="img" aria-label="График роста копилки">
        {/* ось X/Y */}
        <line x1={P} y1={H-P} x2={W-P} y2={H-P} stroke="#e2e8f0" />
        <line x1={P} y1={P} x2={P} y2={H-P} stroke="#e2e8f0" />
        {line('total', false)}
        {line('invested', true)}
        {dots('total', '#0ea5e9')}
        {dots('invested', '#64748b')}
      </svg>
      <div className="text-xs text-slate-500 px-1 pt-2">График по годам (0…{data.length - 1})</div>
    </div>
  );
}

// ====================== Самопроверка/тесты ======================
function nearlyEqual(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }

function runSelfTests(fns) {
  const { periodicForGoal, futureValueVariableContribution, periodsPerYear } = fns;
  const results = [];

  // Тест 1: periodicForGoal без процентов — 1200$ цель за 1 год, месячно => 100$ за период
  {
    const got = periodicForGoal(1200, 0, 1, false, 'monthly');
    results.push({ name: 'goal(no interest) 1200 / 12 = 100', pass: nearlyEqual(got, 100), expected: 100, got: round2(got) });
  }

  // Тест 2: periodicForGoal с процентом — проверяем обратимость через конструирование цели
  {
    const PY = periodsPerYear('monthly');
    const r = 0.12 / PY; // 12% годовых
    const n = 12;
    const targetPayment = 100;
    const goal = targetPayment * (Math.pow(1 + r, n) - 1) / r; // обратная формула для ordinary annuity
    const got = periodicForGoal(goal, 12, 1, true, 'monthly');
    results.push({ name: 'goal(interest) invert to payment≈100', pass: nearlyEqual(got, targetPayment, 1e-4), expected: round4(targetPayment), got: round4(got) });
  }

  // Тест 3: FV без процентов и без роста — должно быть просто сумма взносов
  {
    const res = futureValueVariableContribution(100, 0, 1, false, 'monthly', 0);
    results.push({ name: 'FV no interest: 100*12 = 1200', pass: nearlyEqual(res.fv, 1200), expected: 1200, got: round2(res.fv) });
  }

  // Тест 4: FV при процентах, без роста — сверяем с формулой annuity-due
  {
    const PY = periodsPerYear('monthly');
    const r = 0.12 / PY; // 12% годовых
    const n = 12;
    const P = 100;
    const expected = P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r); // annuity-due
    const res = futureValueVariableContribution(P, 12, 1, true, 'monthly', 0);
    results.push({ name: 'FV with interest (annuity-due)', pass: nearlyEqual(res.fv, expected, 1e-4), expected: round4(expected), got: round4(res.fv) });
  }

  const passed = results.filter(r => r.pass).length;
  return { results, passed, total: results.length };
}

function round2(x) { return Math.round(x * 100) / 100; }
function round4(x) { return Math.round(x * 10000) / 10000; }
