import React, { useEffect, useState } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [addedFoods, setAddedFoods] = useState({});

  // Handle photo nutrition data when route params change
  useEffect(() => {
    const photoNutritionData = route.params?.photoNutritionData;
    const selectedMeal = route.params?.selectedMeal;

    if (photoNutritionData && selectedMeal) {
      // Update addedFoods
      setAddedFoods(prevFoods => ({
        ...prevFoods,
        [selectedMeal]: [...(prevFoods[selectedMeal] || []), photoNutritionData]
      }));

      // Clear the navigation params after processing
      navigation.setParams({ photoNutritionData: undefined, selectedMeal: undefined });
    }
  }, [route.params, navigation]);

  return (
    // Rest of the component code
  );
};

export default HomeScreen; 