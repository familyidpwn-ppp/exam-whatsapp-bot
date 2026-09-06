# 🚀 Exam Updates to WhatsApp Automation Bot

यह बॉट किसी भी वेबसाइट से परीक्षा / रिजल्ट / एडमिट कार्ड के अपडेट्स को ऑटोमैटिक स्क्रैप करके आपके **WhatsApp Group** में भेजता है।

---

## 📁 फ़ाइल संरचना (Project Structure)

| फ़ाइल | विवरण |
| :--- | :--- |
| `config.json` | टारगेट वेबसाइट का URL, WhatsApp ग्रुप का नाम, और चेक इंटरवल |
| `scraper.js` | वेबसाइट से अपडेट्स निकालने का स्क्रैपर (Anti-bot Headers के साथ) |
| `whatsapp.js` | WhatsApp Web ऑटोमेशन (QR कोड लॉगिन + ग्रुप मैसेज डिलीवरी) |
| `database.js` | डुप्लीकेट रोकने के लिए हिस्ट्री रिकॉर्ड कीपर (`data/history.json`) |
| `index.js` | मुख्य कंट्रोलर जो 24/7 ऑटोमेशन शेड्यूल चलाता है |
| `test_scraper.js` | बिना WhatsApp के तुरंत स्क्रैपर टेस्ट करने की स्क्रिप्ट |
| `ecosystem.config.js` | PM2 से 24/7 बैकग्राउंड में चलाने के लिए कॉन्फ़िग |

---

## ⚙️ कॉन्फ़िगरेशन (`config.json`)

```json
{
  "target_group_name": "Exam Updates",
  "website_url": "https://www.sarkariresult.com",
  "check_interval_minutes": 10,
  "enable_debug_logging": true
}
```

- **`target_group_name`**: जिस WhatsApp ग्रुप में अपडेट्स भेजने हैं उसका हूबहू नाम लिखें।
- **`website_url`**: जिस वेबसाइट से अपडेट्स निकालने हैं उसका URL।
- **`check_interval_minutes`**: कितने मिनट बाद नई अपडेट्स चेक करनी हैं (Default: 10 मिनट)।

---

## 🏃‍♂️ कैसे चलाएं (How to Run)

### 1. स्क्रैपर टेस्ट करना (बिना WhatsApp के):
```powershell
node test_scraper.js
```

### 2. बॉट स्टार्ट करना (WhatsApp लॉगिन के साथ):
```powershell
node index.js
```
- पहली बार टर्मिनल में एक **QR Code** आएगा।
- अपने फ़ोन के WhatsApp में जाएं -> **Linked Devices** -> **Link a Device** -> QR कोड स्कैन करें।
- स्कैन होते ही सेशन सुरक्षित सेव हो जाएगा। इसके बाद जब भी नया अपडेट आएगा, ग्रुप में तुरंत मैसेज चला जाएगा!

---

## 🛡️ 24/7 बिना रुके बैकग्राउंड में चलाना (PM2):

अगर आप चाहते हैं कि टर्मिनल बंद करने के बाद भी यह बैकग्राउंड में हमेशा चलता रहे:

```powershell
# PM2 इनस्टॉल करें (यदि पहले से नहीं है)
npm install -g pm2

# बॉट को 24/7 बैकग्राउंड में स्टार्ट करें
pm2 start ecosystem.config.js

# स्टेटस चेक करने के लिए
pm2 status

# लाइव लॉग्स देखने के लिए
pm2 logs
```
