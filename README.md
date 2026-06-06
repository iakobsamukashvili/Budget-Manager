# პროექტ-ტრეკერი 📊

AI-powered პროექტების ხარჯების მმართველი — ქართულად.

## Vercel-ზე Deploy

### მეთოდი 1: GitHub (რეკომენდებული)

1. შექმენი GitHub ანგარიში → [github.com](https://github.com)
2. ახალი repository → ატვირთე ეს ფაილები
3. გადადი [vercel.com](https://vercel.com) → "New Project"
4. GitHub repository დაუკავშირე
5. **Environment Variables** განყოფილებაში დაამატე:
   - Key: `VITE_GEMINI_API_KEY`
   - Value: შენი Gemini API გასაღები (`AIza...`)
6. "Deploy" → მიიღებ URL-ს

### მეთოდი 2: Vercel CLI

```bash
npm install -g vercel
cd project-tracker
vercel
```

## API გასაღები

- გადადი: [aistudio.google.com](https://aistudio.google.com)
- API Keys → Create Key
- აპში ⚠ API ღილაკზე დააჭირე და შეიყვანე გასაღები

## ტელეფონზე ინსტალაცია (PWA)

1. Chrome-ში გახსენი შენი Vercel URL
2. ⋮ მენიუ → "Add to Home Screen"
3. ჩვეულებრივი აპივით გამოიყენე!

## გამოყენება

ჩვეულებრივ ქართულად ელაპარაკე:
- "AI WEEK-ზე 450₾ ვხარჯე ტრანსპორტზე"
- "Rethink პროექტი დაამატე"  
- "სულ რამდენი გავხარჯე?"
- "გადახდილი ხარჯები ჩამოთვალე"
