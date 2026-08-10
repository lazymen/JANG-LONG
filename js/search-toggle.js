const searchEntry = document.getElementById("search-entry");
const searchPanel = document.getElementById("search-panel");
const searchForm = document.getElementById("site-search-form");
const searchInput = document.getElementById("site-search-input");

if (searchEntry && searchPanel) {

    searchEntry.addEventListener("click", () => {

        searchPanel.classList.toggle("active");

        if (searchPanel.classList.contains("active")) {

            searchInput.focus();

        }

    });

}


if (searchForm && searchInput) {

    searchForm.addEventListener("submit", (event) => {

        event.preventDefault();

        const query = searchInput.value.trim();

        if (!query) {

            window.location.href = "search.html";

            return;

        }

        window.location.href =
            `search.html?q=${encodeURIComponent(query)}`;

    });

}