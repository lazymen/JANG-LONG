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
// MOBILE HORIZONTAL MENU
// ===============================

const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const mobileMenuList = document.getElementById("mobile-menu-list");

mobileMenuBtn.addEventListener("click", () => {

    mobileMenuList.classList.toggle("active");

});

// ===============================
// MOBILE SWIPE
// ===============================

let startX = 0;

const sliderWindow = document.querySelector(".slider-window");

const heroSlider = document.querySelector(".hero-slider");

function hideMobileArrows() {

    if (window.innerWidth > 768) return;

    if (mobileHintHidden) return;

    mobileHintHidden = true;

    heroSlider.classList.add("hide-mobile-arrows");

}

sliderWindow.addEventListener("touchstart", (e) => {

    startX = e.touches[0].clientX;

});



sliderWindow.addEventListener("touchend", (e) => {

    const endX = e.changedTouches[0].clientX;

    const diff = startX - endX;

    if (Math.abs(diff) < 40) {

        return;

    }

    if (diff > 0) {

        next.click();

        hideMobileArrows();

    } else {

        prev.click();

        hideMobileArrows();

    }

});