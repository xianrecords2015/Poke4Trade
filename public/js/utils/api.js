const API_BASE = '/pokemon-api';

const PokemonAPI = {
    async getSets() {
        try {
            const response = await fetch(`${API_BASE}/sets`);
            const data = await response.json();
            return { success: true, data: data.data || [] };
        } catch (error) {
            console.error('Error fetching sets:', error);
            return { success: false, data: [], error: error.message };
        }
    },

    async getCardsFromSet(setId, page = 1, pageSize = 20) {
        try {
            const response = await fetch(
                `${API_BASE}/cards?q=set.id:${setId}&page=${page}&pageSize=${pageSize}`
            );
            const data = await response.json();
            return {
                success: true,
                data: data.data || [],
                totalCount: data.totalCount || 0
            };
        } catch (error) {
            console.error('Error fetching cards:', error);
            return { success: false, data: [], error: error.message };
        }
    },

    async searchCards(query, page = 1, pageSize = 20) {
        try {
            const response = await fetch(
                `${API_BASE}/cards?q=name:${query}&page=${page}&pageSize=${pageSize}`
            );
            const data = await response.json();
            return {
                success: true,
                data: data.data || [],
                totalCount: data.totalCount || 0
            };
        } catch (error) {
            console.error('Error searching cards:', error);
            return { success: false, data: [], error: error.message };
        }
    }
};

window.PokemonAPI = PokemonAPI;
