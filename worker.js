export default {
  async fetch(request, env, ctx) {
    // Maqsadli sayt manzili
    const targetUrl = "https://alpha4uzs.lovable.app";

    try {
      // Saytdan ma'lumotni server darajasida yuklab olamiz
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
        }
      });

      // Kelgan javob sarlavhalarini o'zgartirish uchun yangi ob'ekt yaratamiz
      const newHeaders = new Headers(response.headers);

      // Saytni iframe yoki istalgan joyda ochilishini to'sayotgan xavfsizlik sarlavhalarini o'chiramiz
      newHeaders.delete("X-Frame-Options");
      newHeaders.delete("Content-Security-Policy");
      newHeaders.delete("content-security-policy");
      
      // CORS muammolari bo'lmasligi uchun ruxsat beramiz
      newHeaders.set("Access-Control-Allow-Origin", "*");

      // O'zgartirilgan sarlavhalar va toza kontentni foydalanuvchiga qaytaramiz
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });

    } catch (error) {
      return new Response("Saytni yuklashda xatolik yuz berdi: " + error.message, { status: 500 });
    }
  }
};
