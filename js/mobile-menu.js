const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const mobileMenuList = document.getElementById("mobile-menu-list");

if (mobileMenuBtn && mobileMenuList) {

    mobileMenuBtn.addEventListener("click", () => {

        mobileMenuList.classList.toggle("active");

    });

}