// Basit anti-spam test kodu
// Bu dosya, anti-spam ve anti-link özelliklerini doğrudan test etmek için kullanılabilir

const antiSpam = {
    checkMessage: function(message) {
        console.log(`Anti-spam kontrol: ${message.content}`);
        
        // Basit spam tespiti
        const now = Date.now();
        const userMessages = this.userMessageMap.get(message.author.id) || [];
        
        // Son 3 saniye içindeki mesajları filtrele
        const recentMessages = userMessages.filter(m => now - m.timestamp < 3000);
        
        // Yeni mesajı ekle
        recentMessages.push({
            content: message.content,
            timestamp: now
        });
        
        // Mesaj sayısını güncelle
        this.userMessageMap.set(message.author.id, recentMessages);
        
        console.log(`Kullanıcı son 3 sn içinde ${recentMessages.length} mesaj gönderdi`);
        
        // 5 veya daha fazla mesaj varsa spam olarak algıla
        if (recentMessages.length >= 5) {
            console.log(`SPAM TESPİT EDİLDİ: ${message.author.tag}`);
            
            // Ceza uygula: timeout veya mute
            this.applyTimeout(message.member);
            
            // Spam tespit edildi, true döndür
            return true;
        }
        
        return false;
    },
    
    applyTimeout: function(member) {
        console.log(`${member.user.tag} kullanıcısına timeout uygulanıyor...`);
        // Discord.js v13 timeout özelliği
        try {
            member.timeout(5 * 60 * 1000, "Spam yapma nedeniyle otomatik zaman aşımı")
                .then(() => console.log(`${member.user.tag} kullanıcısına timeout uygulandı`))
                .catch(error => console.error(`Timeout hatası: ${error.message}`));
        } catch (error) {
            console.error(`Timeout uygulanamadı: ${error.message}`);
        }
    },
    
    // Test için kullanıcı mesaj verilerini saklamak için koleksiyon
    userMessageMap: new Map()
};

const antiLink = {
    checkMessage: function(message) {
        console.log(`Anti-link kontrol: ${message.content}`);
        
        // Basit link tespiti
        const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|gg))/gi;
        
        if (linkRegex.test(message.content)) {
            console.log(`LİNK TESPİT EDİLDİ: ${message.content}`);
            
            // Ceza uygula: timeout veya mute
            this.applyTimeout(message.member);
            
            // Link tespit edildi, true döndür
            return true;
        }
        
        return false;
    },
    
    applyTimeout: function(member) {
        console.log(`${member.user.tag} kullanıcısına link paylaşımı nedeniyle timeout uygulanıyor...`);
        // Discord.js v13 timeout özelliği
        try {
            member.timeout(5 * 60 * 1000, "Link paylaşımı nedeniyle otomatik zaman aşımı")
                .then(() => console.log(`${member.user.tag} kullanıcısına timeout uygulandı`))
                .catch(error => console.error(`Timeout hatası: ${error.message}`));
        } catch (error) {
            console.error(`Timeout uygulanamadı: ${error.message}`);
        }
    }
};

// Örnek kullanım:
// Sahte message objesi oluştur
const createFakeMessage = (content, author, member) => {
    return {
        content,
        author,
        member
    };
};

// Sahte kullanıcı ve üye objesi
const fakeUser = { id: '123456789', tag: 'TestUser#1234' };
const fakeMember = {
    user: fakeUser,
    timeout: function(duration, reason) {
        console.log(`MEMBER.TIMEOUT çağrıldı: ${duration}ms, sebep: ${reason}`);
        return Promise.resolve();
    }
};

// Test fonksiyonu
function runTests() {
    console.log("====== SPAM TESTİ BAŞLIYOR ======");
    
    // Spam testi - normal mesajlar
    for (let i = 1; i <= 3; i++) {
        const msg = createFakeMessage(`Test mesaj ${i}`, fakeUser, fakeMember);
        antiSpam.checkMessage(msg);
    }
    
    console.log("\n----- 1 saniye bekleniyor -----\n");
    setTimeout(() => {
        // Spam testi - hızlı mesajlar (spam)
        for (let i = 4; i <= 6; i++) {
            const msg = createFakeMessage(`Spam test ${i}`, fakeUser, fakeMember);
            antiSpam.checkMessage(msg);
        }
        
        console.log("\n====== LİNK TESTİ BAŞLIYOR ======");
        
        // Link testi - normal mesaj
        const normalMsg = createFakeMessage("Bu bir normal mesajdır", fakeUser, fakeMember);
        antiLink.checkMessage(normalMsg);
        
        // Link testi - link içeren mesaj
        const linkMsg = createFakeMessage("Bu bir linktir: https://discord.gg/invite", fakeUser, fakeMember);
        antiLink.checkMessage(linkMsg);
        
        console.log("\n====== TESTLER TAMAMLANDI ======");
    }, 1000);
}

// Testleri çalıştır
runTests();