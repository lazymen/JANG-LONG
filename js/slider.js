const slides = document.querySelectorAll(".slide");

const currentSlide = document.getElementById("current-slide");
const totalSlide = document.getElementById("total-slide");

totalSlide.textContent = String(slides.length).padStart(2, "0");

const next = document.querySelector(".next");
const prev = document.querySelector(".prev");

let current = 0;

let mobileHintHidden = false;

function showSlide(index) {

    slides.forEach(slide => {
        slide.classList.remove("active");
    });

    slides[index].classList.add("active");
    currentSlide.textContent =
        String(index + 1).padStart(2, "0");

}

next.addEventListener("click", () => {

    current++;

    if (current >= slides.length) {

        current = 0;

    }

    showSlide(current);

    hideMobileArrows();

});

prev.addEventListener("click", () => {

    current--;

    if (current < 0) {

        current = slides.length - 1;

    }

    showSlide(current);

    hideMobileArrows();

});

// ===============================
// MOBILE SWIPE
// ===============================

let startX = 0;

const sliderWindow = document.querySelector(".slider-window");

sliderWindow.addEventListener("click", () => {

    if (window.innerWidth > 768) return;

    next.click();

});

const heroSlider = document.querySelector(".hero-slider");

function hideMobileArrows() {

    console.log("hideMobileArrows 실행");

    if (window.innerWidth > 768) return;

    if (mobileHintHidden) return;

    mobileHintHidden = true;

    heroSlider.classList.add("hide-mobile-arrows");

    console.log(heroSlider.className);

}

sliderWindow.addEventListener("touchstart", (e) => {

    startX = e.touches[0].clientX;

});



sliderWindow.addEventListener("touchend", (e) => {

    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;

    if (Math.abs(diff) < 40) return;

    hideMobileArrows();   // 먼저 숨김

    if (diff > 0) {

        current++;

        if (current >= slides.length) current = 0;

    } else {

        current--;

        if (current < 0) current = slides.length - 1;

    }

    showSlide(current);

});