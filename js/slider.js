const slides = document.querySelectorAll(".slide");

const currentSlide = document.getElementById("current-slide");
const totalSlide = document.getElementById("total-slide");

totalSlide.textContent = String(slides.length).padStart(2,"0");

const next = document.querySelector(".next");
const prev = document.querySelector(".prev");

let current = 0;

function showSlide(index){

    slides.forEach(slide=>{
        slide.classList.remove("active");
    });

    slides[index].classList.add("active");
currentSlide.textContent =
    String(index + 1).padStart(2,"0");
    
}

next.addEventListener("click",()=>{

    current++;

    if(current >= slides.length){

        current = 0;

    }

    showSlide(current);

});

prev.addEventListener("click",()=>{

    current--;

    if(current < 0){

        current = slides.length - 1;

    }

    showSlide(current);

});

// ===============================
// MOBILE MENU
// ===============================

const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const sidebar = document.getElementById("mobile-sidebar");

mobileMenuBtn.addEventListener("click", () => {

    sidebar.classList.toggle("active");

});